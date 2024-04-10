#!/bin/bash
sudo apt update -y
sudo apt install curl unzip -y
curl -L -o sentry-node-cli-linux.zip https://github.com/xai-foundation/sentry/releases/latest/download/sentry-node-cli-linux.zip
unzip sentry-node-cli-linux.zip
