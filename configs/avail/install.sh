#!/bin/bash

# get the source code
git clone https://github.com/availproject/avail.git

cd avail

mkdir -p output
mkdir -p data

git checkout v1.8.0.2