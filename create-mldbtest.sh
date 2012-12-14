#!/bin/sh


curl -v --anyauth --user admin:admin -X POST \
    -d'{"rest-api":{"name":"mldbtest-rest-9090","database": "mldbtest","modules-database": "mldbtest-modules","port": "9090"}}' \
    -H "Content-type: application/json" \
    http://localhost:8002/v1/rest-apis
