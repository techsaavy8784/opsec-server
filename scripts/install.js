// Import necessary modules
import ssh from "../utils/ssh.js"
import path from "path"

async function processNode({ host, port, username, password, blockchainName }) {
  console.log("Processing node for blockchain:", blockchainName)
  console.log(`Connecting to server - ${host}:${port}...`)

  const remote = new ssh(host, port, username, password)
  try {
    await remote.connect()
    console.log("Connected to server")

    // Set directories and files
    const currentPath = process.cwd()
    const homeDir = await remote.getHomeDirectory()
    const remotePath = homeDir.trim()
    const blockchainNameFormatted = blockchainName
      .toLowerCase()
      .replace(/\s+/g, "-")
    const blockchainPath = `${remotePath}/${blockchainNameFormatted}`
    const prepareScript = path.join(currentPath, "configs/default/prepare.sh")
    const blockchainFolder = path.join(
      currentPath,
      `configs/${blockchainName}`.toLocaleLowerCase()
    )

    // Check if server is initialized
    console.log("Checking if server is initialized...")
    const exists = await remote.checkFileExists(`${remotePath}/.initialized`)
    const initialized = exists.trim() == "exists"
    console.log("Server initialized:", initialized)

    if (!initialized) {
      console.log("Server not initialized. Preparing...")
      await remote.scpFile(prepareScript, `${remotePath}/prepare.sh`)
      console.log("Copied prepare.sh to server")

      await remote.changePermissions(`${remotePath}/prepare.sh`, "+x")
      console.log("Changed permissions for prepare.sh")

      console.log("Executing prepare.sh")
      await remote.executeCommand(`${remotePath}/prepare.sh`)

      console.log("Server initialized")
    }

    // Check if blockchain folder exists
    console.log("Checking if blockchain exists...")
    const blockchainExists = await remote.checkFileExists(blockchainPath)
    const blockchainFolderExists = blockchainExists.trim() == "exists"
    console.log("Blockchain exists:", blockchainFolderExists)

    if (!blockchainFolderExists) {
      console.log(`Creating node for ${blockchainName}...`)
      await remote.createDirectory(blockchainPath)

      await remote.scpDirectory(blockchainFolder, blockchainPath)
      console.log("Copied blockchain configs to server")

      await remote.moveFile(
        `${blockchainPath}/.config`,
        `${blockchainPath}/.env`
      )

      console.log("Installing blockchain...")

      await remote.changePermissions(`${blockchainPath}/install.sh`, "+x")
      await remote.changePermissions(`${blockchainPath}/run.sh`, "+x")

      await remote.executeCommand(`cd ${blockchainPath} && ./install.sh`)

      console.log("Blockchain installed")

      console.log("Starting blockchain...")
      await remote.executeCommand(`cd ${blockchainPath} && ./run.sh`, false)
    } else {
      console.log(`Blockchain folder already exists for ${blockchainName}`)
    }

    remote.disconnect()
  } catch (error) {
    console.error("SSH operation failed:", error)
    remote.disconnect()
  }
}

const [, , host, port, username, password, blockchainName] = process.argv

if (!host || !port || !username || !password || !blockchainName) {
  console.log(
    "Usage: node install.js <host> <port> <username> <password> <blockchainName>"
  )
  process.exit(1)
}

processNode({ host, port, username, password, blockchainName: blockchainName })
