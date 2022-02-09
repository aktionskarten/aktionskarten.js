#!/bin/sh

while ! wget -q -t 1 ${BACKEND_HOST}:${BACKEND_PORT}/api/maps; do
    echo "Connecting to ${BACKEND_HOST} Failed"
    sleep 1
done

npm run test
