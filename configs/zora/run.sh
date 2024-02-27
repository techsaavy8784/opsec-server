#!/bin/bash

# Select the network you want to run and set CONDUIT_NETWORK env variable. 
# You will need to know the slug of the network. 
# You can find this in the Conduit console. 
export CONDUIT_NETWORK=zora-mainnet-0
# Note: The external nodes feature must be enabled on the network for this to work. 
cd node
# Download the required network configuration with:
./download-config.py $CONDUIT_NETWORK

# Start the node!
docker compose up --build -d
