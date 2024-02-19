#!/bin/bash
cd simple-optimism-node
sed -i 's/:7300/:7303/g' docker-compose.yml
sed -i 's/\${PORT__HEALTHCHECK_METRICS:-7300}/\${PORT__HEALTHCHECK_METRICS:-7303}/g' docker-compose.yml
docker compose up -d --build
