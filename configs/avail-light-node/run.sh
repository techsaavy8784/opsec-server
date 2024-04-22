#!/bin/bash
output=$(curl -sL1 avail.sh | bash)
key_line=$(echo "$output" | grep "Avail ss58 address")
echo "$key_line" > .publickey

