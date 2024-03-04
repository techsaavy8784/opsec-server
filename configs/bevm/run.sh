#!/bin/bash
sudo docker run -d -v /var/lib/node_bevm_test_storage:/root/.local/share/bevm btclayer2/bevm:v0.1.1 bevm "--chain=testnet" "--name=$(cat .wallet)" "--pruning=archive" --telemetry-url "wss://telemetry.bevm.io/submit 0"
