import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import database from "../utils/db.js"
import ssh from "../utils/ssh.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// console.log(path.join(__dirname, "..", ".env"))

dotenv.config({ path: path.join(__dirname, "..", ".env") })

async function stopAndRemoveNonNodeContainers(remote) {
  console.log("Fetching all Docker containers...")

  // Get all Docker container names
  const listContainersCmd = `docker ps --format '{{.Names}}'`
  const allContainerNames = await remote.executeCommand(listContainersCmd)

  // Split the output by new lines to get an array of container names
  const containerNames = allContainerNames
    .split("\n")
    .filter((name) => name.trim() !== "")

  console.log(`Found containers: ${containerNames.join(", ")}`)

  for (const name of containerNames) {
    // Check if the container name does not include '-node'
    if (!name.includes("-node")) {
      console.log(`Stopping and removing container: ${name}`)

      // Stop the Docker container
      await remote.executeCommand(`docker stop ${name}`)
      console.log(`Container stopped: ${name}`)

      // Remove the Docker container
      await remote.executeCommand(`docker rm ${name}`)
      console.log(`Container removed: ${name}`)
    }
  }

  console.log("Processing complete.")
}

async function deleteBlockchainDirectory(remote, blockchainPath) {
  try {
    // Attempt to delete the blockchain directory
    await remote.deleteDirectory(blockchainPath)
    console.log("Deleted existing blockchain folder")
  } catch (error) {
    console.error(`Failed to delete directory: ${error.message}`)

    // If deletion fails, find Docker containers using the directory
    const dockerContainerName = await findDockerContainerUsingDirectory(
      remote,
      blockchainPath
    )
    if (dockerContainerName) {
      // Stop and remove the Docker container
      console.log(`Stopping Docker container ${dockerContainerName}...`)
      await remote.executeCommand(`docker stop ${dockerContainerName}`)
      console.log(`Stopped Docker container ${dockerContainerName}.`)
      console.log(`Removing Docker container ${dockerContainerName}...`)
      await remote.executeCommand(`docker rm ${dockerContainerName}`)
      console.log(`Removed Docker container ${dockerContainerName}.`)

      // Retry directory deletion
      try {
        await remote.deleteDirectory(blockchainPath)
        console.log(
          "Successfully deleted the blockchain folder after stopping Docker container."
        )
      } catch (retryError) {
        console.error(
          `Failed to delete directory after stopping container: ${retryError.message}`
        )
      }
    } else {
      console.error(
        "No Docker container found using the directory, or unable to determine."
      )
    }
  }
}

async function findDockerContainerUsingDirectory(remote, directoryPath) {
  // This is a placeholder function. Implement the logic to identify the Docker container
  // using the directory. You might need to adjust this based on actual use case and available information.
  const checkContainersCmd = `docker ps -qa --filter "volume=${directoryPath}"`
  const containerId = await remote.executeCommand(checkContainersCmd)
  return containerId.trim()
}

async function processNode(node) {
  console.log("Processing node:", node.id)
  console.log("Blockchain:", node.blockchain_name)

  console.log(`Connecting to server - ${node.host}:${node.port}...`)
  const remote = new ssh(node.host, node.port, node.username, node.password)
  try {
    await remote.connect()
    console.log("Connected to server")

    // set directories and files
    const currentPath = process.cwd()
    const homeDir = await remote.getHomeDirectory()
    const remotePath = homeDir.trim()
    const blockchainNameFormatted = node.blockchain_name
      .toLowerCase()
      .replace(/\s+/g, "-")
    const blockchainPath = `${remotePath}/${blockchainNameFormatted}`
    const prepareScript = path.join(currentPath, "configs/default/prepare.sh")
    const blockchainFolder = path.join(
      currentPath,
      `configs/${node.blockchain_name}`.toLocaleLowerCase()
    )

    // console.log("prepareScript:", prepareScript)
    // console.log("blockchainFolder:", blockchainFolder)
    // console.log("remotePath:", remotePath)

    // update node status
    await updateNodeStatus(node.id, "INSTALLING")

    // check if server is initialized
    console.log("Checking if server is initialized...")
    const exists = await remote.checkFileExists(`${remotePath}/.initialized`)
    const initialized = exists.trim() == "exists"
    console.log("Server initialized:", initialized)

    // if (!initialized) {
    console.log("Server not initialized. Preparing...")
    await remote.scpFile(prepareScript, `${remotePath}/prepare.sh`)
    console.log("Copied prepare.sh to server")

    await remote.changePermissions(`${remotePath}/prepare.sh`, "+x")
    console.log("Changed permissions for prepare.sh")

    console.log("Executing prepare.sh")
    await remote.executeCommand(`${remotePath}/prepare.sh`)

    console.log("Server initialized")
    // }

    // Check if blockchain folder exists
    console.log("Checking if blockchain exists...")
    const blockchainExists = await remote.checkFileExists(blockchainPath, true)
    const blockchainFolderExists = blockchainExists.trim() == "exists"
    console.log("Blockchain exists: ", blockchainFolderExists)

    if (blockchainFolderExists) {
      console.log(
        `Blockchain folder already exists for ${node.blockchain_name}`
      )

      // await stopAndRemoveNonNodeContainers(remote)

      const dockerContainerName = `${node.blockchain_name.toLocaleLowerCase()}-node`

      // Check if the Docker container exists
      const checkContainerExistsCmd = `docker ps -a -q -f name=^${dockerContainerName}$`
      const containerId = await remote.executeCommand(checkContainerExistsCmd)

      if (containerId.trim()) {
        // Stop the Docker container if it exists
        console.log(`Stopping Docker container ${dockerContainerName}...`)
        await remote.executeCommand(`docker stop ${dockerContainerName}`, false)
        console.log(`Docker container ${dockerContainerName} stopped.`)

        // Remove the Docker container
        console.log(`Removing Docker container ${dockerContainerName}...`)
        await remote.executeCommand(`docker rm ${dockerContainerName}`, false)
        console.log(`Docker container ${dockerContainerName} removed.`)
      } else {
        console.log(
          `No such container: ${dockerContainerName}, skipping stop and remove.`
        )
      }

      await deleteBlockchainDirectory(remote, blockchainPath)

      // await remote.deleteDirectory(blockchainPath)
      // console.log("Deleted existing blockchain folder")
    }

    // commence node deployment
    console.log(`Creating node for ${node.blockchain_name}...`)
    await remote.createDirectory(blockchainPath)

    await remote.scpDirectory(blockchainFolder, blockchainPath)
    console.log("Copied blockchain configs to server")

    await remote.moveFile(`${blockchainPath}/.config`, `${blockchainPath}/.env`)

    console.log("Installing blockchain...")

    await remote.changeDirectory(blockchainPath)

    await remote.changePermissions(`${blockchainPath}/install.sh`, "+x")
    await remote.changePermissions(`${blockchainPath}/run.sh`, "+x")

    await remote.executeCommand(`cd ${blockchainPath} && ./install.sh`)

    console.log("Blockchain installed")

    // check if blockchain has wallet
    if (node.blockchain_wallet) {
      console.log("Blockchain has wallet. Creating wallet...")
      await remote.writeFile(`${blockchainPath}/.wallet`, node.wallet)
      console.log("Wallet created")
    }

    console.log("Starting blockchain...")
    await remote.executeCommand(`cd ${blockchainPath} && ./run.sh`, true) // TODO: change to true after testing

    console.log("Started blockchain...")

    // update node status
    await updateNodeStatus(node.id, "LIVE")

    remote.disconnect()
  } catch (error) {
    console.error("SSH operation failed:", error)
    remote.disconnect()
    await updateNodeStatus(node.id, "FAILED")
  }
}

async function updateNodeStatus(nodeId, status) {
  const sqlUpdate = `UPDATE nodes SET status = $1 WHERE id = $2;`
  try {
    const res = await database.query(sqlUpdate, [status, nodeId])
    if (res.rowCount === 0) {
      throw new Error(`Failed to update status for Node ${nodeId}`)
    }
  } catch (error) {
    console.error(`Error updating node ${nodeId} status to ${status}:`, error)
  }
}

async function processNodes() {
  try {
    const sqlQuery = `
      SELECT
        nodes.id,
        nodes.status,
        nodes.wallet,
        nodes.created_at,
        nodes.server_id,
        servers.host,
        servers.port,
        servers.username,
        servers.password,
        servers.active,
        nodes.blockchain_id,
        blockchains.name AS blockchain_name,
        blockchains.has_wallet AS blockchain_wallet
      FROM nodes
      JOIN servers ON nodes.server_id = servers.id
      JOIN blockchains ON nodes.blockchain_id = blockchains.id
      WHERE nodes.status = 'CREATED';
    `

    const { rows } = await database.query(sqlQuery)

    if (rows.length > 0) {
      console.log(
        `Found ${rows.length} node reqest(s). Processing concurrently...`
      )

      await Promise.all(rows.map((node) => processNode(node)))
    } else {
      console.log("Waiting for requests...")
    }
  } catch (error) {
    console.error("Error fetching nodes:", error)
  } finally {
    // await pool.end();
  }
}

function scheduleCheck() {
  processNodes().then(() => {
    setTimeout(scheduleCheck, 5000)
  })
}

console.log("Starting node processing...")
scheduleCheck()
