/*global Buffer: false, clearInterval: false, clearTimeout: false, console: false, global: false, module: false, exports: false, process: false, require: false, setInterval: false, setTimeout: false, __filename: false, __dirname: false */
(function() {
    'use strict';

    // external libraries
    var conf = require('./config');
    var express = require('express');
    var app = express();
    var http_port = conf.http_port;
    var _ = require('underscore');
    var Memcached = require('memcached');
    var memcache = new Memcached(conf.memcached_server);
    var ejs = require('ejs');
    var moment = require('moment');

    ejs.filters.prettyDate = function (date) {
        return moment(date).format('lll');
    };

    global.sprintf = require('sprintf').sprintf;

    (function() {
        global.config_get = function config_get(name) {
            return conf[name];
        };

        global.BASE_HTTP_URL = conf.base_url;
        global.BASE_HTTPS_URL = conf.base_secure_url;
    }());

    function check_websites (websites) {
        var Q = require('q'),
            http = require('q-io/http'),
            ps = [], result = {},
            cache_prefix = 'is-apple-down.com:website';

        return Q.ninvoke(memcache, 'get', cache_prefix + ':all').then(function (data) {
            if (data) {
                return data;
            }
            
            _.each(websites, function (url, key) {
                var p = http.request({url: url, method: 'HEAD'}).then(function (res) {
                    var status = res.statusCode >= 200 && res.statusCode < 300;
                    result[key] = status;
                });
                ps.push(p);
            });

            return Q.all(ps).then(function () {
                var data = {
                    statuses: result,
                    updated: new Date()
                };
                memcache.set(cache_prefix + ':all', data, 60, function (err) {});
                return data;
            });
        });
    }

    function configure(app) {
        // app configuration
        app.configure('development', function() {
            app.use(express.errorHandler({
                dumpException: true,
                showStack: true
            }));
            app.use(express.cookieParser());
        });

        app.configure('production', function() {
            app.use(express.errorHandler({
                dumpException: true,
                showStack: true
            }));
            app.use(express.cookieParser());
            app.enable('trust proxy');
        });

        app.configure(function() {
            var path = require('path');

            app.use(express.bodyParser());
            app.set('view engine', 'ejs');
        });

        app.get('/', function (req, res, next) {
            check_websites({
                ios: 'https://developer.apple.com/devcenter/ios/index.action',
                mac: 'https://developer.apple.com/devcenter/mac/index.action',
                safari: 'https://developer.apple.com/devcenter/safari/index.action'
            }).then(function (result) {
	            res.format({
                    html: function () {
                        res.render('index', result);
                    },
                    json: function () {
                        res.send(200, result);
                    }
                });
            }).fail(function () {
                res.send(500);
            });
        });

        return app
    }

    configure(app).listen(http_port);
}.call(this));
