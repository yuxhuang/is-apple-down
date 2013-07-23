#!/bin/sh

export NODE_ENV=production

while true; do
	node ./app.js | tee -a log/app.log
done

