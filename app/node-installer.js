import dotenv from "dotenv"
dotenv.config({ path: "../.env" })

import database from "../utils/db.js"
import ssh from "../utils/ssh.js"
import path from "path"
import fs from "fs"

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
    console.log("Blockchain exists: ", blockchainFolderExists)

    if (blockchainFolderExists) {
      // TODO: handle error and update db
      // this should never happen
      // maybe re-assign a new node to same user?

      console.log(
        `Blockchain folder already exists for ${node.blockchain_name}`
      )
      return
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

    console.log("Starting blockchain...")
    await remote.executeCommand(`cd ${blockchainPath} && ./run.sh`, true) // TODO: change to true after testing

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
        nodes.created_at,
        nodes.server_id,
        servers.host,
        servers.port,
        servers.username,
        servers.password,
        servers.active,
        nodes.blockchain_id,
        blockchains.name AS blockchain_name
      FROM nodes
      JOIN servers ON nodes.server_id = servers.id
      JOIN blockchains ON nodes.blockchain_id = blockchains.id
      WHERE nodes.status = 'CREATED';
    `

    const { rows } = await database.query(sqlQuery)

    if (rows.length > 0) {
      console.log(
        `Found ${rows.length} live node(s). Processing concurrently...`
      )

      await Promise.all(rows.map((node) => processNode(node)))
    } else {
      console.log("No live nodes found.")
    }
  } catch (error) {
    console.error("Error fetching nodes:", error)
  } finally {
    // await pool.end();
  }
}

function scheduleCheck() {
  console.log("Starting node processing...")
  processNodes().then(() => {
    setTimeout(scheduleCheck, 5000)
  })
}

scheduleCheck()
