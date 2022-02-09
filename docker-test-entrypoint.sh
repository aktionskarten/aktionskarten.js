#!/bin/sh

while ! wget -q -t 1 -O- ${BACKEND_HOST}:${BACKEND_PORT}/api/maps > /dev/null; do
    echo "Connecting to ${BACKEND_HOST} Failed"
    sleep 1
done

npm run test
