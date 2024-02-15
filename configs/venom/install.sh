#!/bin/bash

apt-get update
apt-get install pkg-config make clang libssl-dev libzstd-dev libgoogle-perftools-dev

git clone --recurse-submodules https://github.com/tonlabs/ever-node.git
