#!/bin/bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install software-properties-common screen -y
sudo add-apt-repository -y ppa:ethereum/ethereum
sudo apt-get update
sudo apt-get install ethereum -y
wget https://docs.linea.build/files/genesis.json
fallocate -l 100G linea.img
mkfs.ext4 linea.img
mkdir linea_data
sudo mount -o loop linea.img linea_data
sudo geth --datadir ./linea_data init ./genesis.json
