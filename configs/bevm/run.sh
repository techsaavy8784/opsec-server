#!/bin/bash

cat <<EOF > config.json
{
  "chain": "testnet",
  "log-dir": "/log",
  "enable-console-log": true,
  "no-mdns": true,
  "validator": true,
  "unsafe-rpc-external": true,
  "offchain-worker": "when-authority",
  "rpc-methods": "unsafe",
  "log": "info,runtime=info",
  "port": 30333,
  "rpc-port": 8087,
  "pruning": "archive",
  "db-cache": 2048,
  "name": "$(cat .wallet)",
  "base-path": "/data",
  "telemetry-url": "wss://telemetry-testnet.bevm.io/submit 1",
  "bootnodes": []
}
EOF

sudo docker run -d --restart always --name bevm-node \
  -p 8087:8087 -p 30333:30333 \
  -v $PWD/config.json:/config.json -v $PWD/data:/data \
  -v $PWD/log:/log -v $PWD/keystore:/keystore \
  btclayer2/bevm:testnet-v0.1.4 /usr/local/bin/bevm \
  --config /config.json "--name=$(cat .wallet)"
