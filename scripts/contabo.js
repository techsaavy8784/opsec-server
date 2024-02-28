import dotenv from "dotenv"
dotenv.config({ path: "../.env" })

import fs from "fs"
import path from "path"
import database from "../utils/db.js"
import SSH from "../utils/ssh.js"

async function addServer({ host, password }) {
  const insertQuery = `
    INSERT INTO servers (host, port, username, password, active)
    VALUES ($1, $2, $3, $4, $5)
  `

  return database.query(insertQuery, [host, 22, "root", password, true])
}

async function processServers(filePath) {
  const absolutePath = path.resolve(filePath)
  fs.readFile(absolutePath, "utf8", async (err, data) => {
    if (err) {
      console.error("Error reading the CSV file:", err)
      return
    }
    try {
      const lines = data.split("\n")
      for (const line of lines) {
        if (!line.trim()) continue

        const [host, password] = line.split(",").map((part) => part.trim())
        await addServer({ host, password })
        console.log(`Server added for ${host}`)
      }
      console.log("All servers have been processed.")
    } catch (error) {
      console.error("Failed to process servers:", error)
    }
  })
}

function generateRandomPassword(length = 12) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+"
  let password = ""
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length)
    password += charset[randomIndex]
  }
  return password
}

async function changePasswords(filePath, logFilePath) {
  const errorLogPath = "./passwords_error.log"

  fs.readFile(filePath, "utf8", async (err, data) => {
    if (err) {
      console.error("Error reading the JSON file:", err)
      return
    }
    try {
      const servers = JSON.parse(data)

      for (const server of servers) {
        const newPassword = generateRandomPassword()
        const sshClient = new SSH(
          server.host,
          server.port.toString(),
          server.username,
          server.password
        )

        try {
          await sshClient.connect()
          await sshClient.executeCommand(
            `echo '${server.username}:${newPassword}' | chpasswd`
          )
          console.log(`Password changed for ${server.host}`)

          fs.appendFileSync(logFilePath, `${server.host},${newPassword}\n`)

          await sshClient.disconnect()
        } catch (error) {
          console.error(`Failed to change password for ${server.host}:`, error)
          fs.appendFileSync(
            errorLogPath,
            `Host: ${server.host}, Error: ${error}\n`
          )
        }
      }

      console.log("All servers have been processed for password change.")
    } catch (error) {
      console.error("Failed to parse servers from JSON:", error)
    }
  })
}

processServers("./passwords.log")

// changePasswords("./servers.json", "./passwords.log")
