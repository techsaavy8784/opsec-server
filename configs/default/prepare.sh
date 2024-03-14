#!/bin/bash

# check if .initialized file exists
# if the file exists, the prepare.sh script will exit without running
# if [ -f ~/.initialized ]; then
#   echo "Installation has already been completed. Exiting..."
#   exit 0
# else
#   echo "Preparing to initialize server..."
# fi

# Update the package list
sudo apt-get update
sudo apt install -y build-essential
sudo apt install --assume-yes curl clang libssl-dev ca-certificates gnupg lsb-release protobuf-compiler

# Check if docker is installed, else install it
if command -v docker &>/dev/null; then
  echo "Docker is already installed."
else
echo "Docker is not installed. Installing..."

# Add Docker's official GPG key:
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository to Apt sources:
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

# Install docker packages
sudo apt-get -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-compose
fi

# Check if Git is installed
if command -v git &>/dev/null; then
  echo "Git is already installed."
else
   echo "Installing git"
  sudo apt-get -y install git-all
fi

# Check if Python 3 is installed
if command -v python3 &>/dev/null; then
    echo "Python 3 is already installed."
else
    echo "Python 3 is not installed. Attempting to install..."

    # Attempt to identify the package manager
    if command -v apt-get &>/dev/null; then
        # Debian-based distributions (Ubuntu, Debian)
        sudo apt-get update
        sudo apt-get install -y python3
    elif command -v yum &>/dev/null; then
        # Red Hat-based distributions (CentOS, Fedora)
        sudo yum update
        sudo yum install -y python3
    else
        echo "Could not identify package manager. Please install Python 3 manually."
        exit 1
    fi

    # Verify Python 3 installation
    if command -v python3 &>/dev/null; then
        echo "Python 3 has been successfully installed."
    else
        echo "Failed to install Python 3."
        exit 1
    fi
fi

# Check if Rust is installed
if command -v rustc &>/dev/null && command -v cargo &>/dev/null; then
  echo "Rust is already installed."
else
  echo "Installing Rust..."
  # Download and install Rust
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

  # Source the cargo environment script to update the current shell's PATH
  # Note: This assumes the default installation location for the current user
  # For other users or global installs, the appropriate profile script must be sourced
  source "$HOME/.cargo/env"

  # Set default to stable and update toolchains
  rustup default stable
  rustup update
  rustup update nightly
  rustup target add wasm32-unknown-unknown --toolchain nightly

  echo "Rust installation complete."
fi

# once installation is complete create a .initialized file in the home directory
cd ~
touch ~/.initialized