#!/bin/bash
sudo docker run -v $(pwd)/state:/da/state:rw -p 30333:30333 -p 9615:9615 -p 9949:9949 -d --restart unless-stopped availj/avail:v1.10.0.0 --chain goldberg --name "$(cat .wallet)" -d /da/state
