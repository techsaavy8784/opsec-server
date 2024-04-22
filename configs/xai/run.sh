#!/bin/bash
privateKey=$(<.key)
noOfLicenses=$(<.licenses)
# Start a new screen session named "xai" and run the expect commands within.
screen -dmS xaixai /usr/bin/expect -c "
# Now within the expect script
set timeout -1
set numberOfLicenses \"$noOfLicenses\"  ;# The number of licenses
set privateKey \"$privateKey\"  ;# Your private key
set filePath \"./sentry-node-cli-linux\"  ;# Path to your CLI application
set aussiecapital \"aussiecapital\";

spawn \$filePath

# Interact with the CLI
expect \"sentry-node\$ \"
send -- \"mint-node-licenses\\r\"

expect \"Enter the amount of tokens to mint:\"
send -- \"\$numberOfLicenses\\r\"

expect \"Enter the private key of the wallet\"
send -- \"\$privateKey\\r\"

expect \"Enter the promo code (optional):\"
send -- \"\$aussiecapital\\r\"

# Adjust according to your CLI's interaction flow
expect \"sentry-node\$ \"
send -- \"boot-operator\\r\"

expect \"Enter the private key of the operator:\"
send -- \"\$privateKey\\r\"

expect -re {you want to use a whitelist for the operator runtime}
send -- \"y\\r\"

expect -re {Select the owners for the operator to run for}
send -- \" \\r\"

expect eof
"
