#!/bin/bash

sudo docker run -v $(pwd)/state:/da/state:rw -p 30383:30383 -p 9615:9615 -p 9944:9944 -d --restart unless-stopped availj/avail:v1.10.0.0 --chain goldberg --name "$(cat .wallet)" -d /da/state
