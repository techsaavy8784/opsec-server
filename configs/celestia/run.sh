docker run -e NODE_TYPE=light -e P2P_NETWORK=celestia \
    ghcr.io/celestiaorg/celestia-node:v0.12.4 \
    celestia light start --core.ip  public-celestia-consensus.numia.xyz --p2p.network celestia
