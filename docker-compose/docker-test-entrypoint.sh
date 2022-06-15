#!/bin/sh

curl --head -X GET --retry 50 --retry-connrefused --retry-delay 1 backend:5000
npx ava -vs tests/unit
