import dotenv from "dotenv"
dotenv.config({ path: "../.env" })

// import fs from "fs"
import { promises as fs } from "fs"
import path from "path"
import fetch from "node-fetch"
import database from "../utils/db.js"
import SSH from "../utils/ssh.js"

const { CLIENT_ID, CLIENT_SECRET, API_USER, API_PASSWORD } = process.env

const getAccessToken = async () => {
  const response = await fetch(
    "https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        username: API_USER,
        password: API_PASSWORD,
        grant_type: "password",
      }),
    }
  )

  const data = await response.json()
  return data.access_token
}

const fetchInstancesPage = async (accessToken, pageUrl) => {
  const response = await fetch(pageUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-request-id": "51A87ECD-754E-4104-9C54-D01AD0F83406",
    },
  })

  return await response.json()
}

const getAllInstances = async () => {
  const accessToken = await getAccessToken()
  const queryParams = new URLSearchParams({
    ipConfig: "true",
    size: "100",
    orderBy: "name:asc",
  }).toString()

  let currentPageUrl = `https://api.contabo.com/v1/compute/instances?${queryParams}`
  const allInstances = []

  do {
    console.log("Fetching page:", currentPageUrl)
    const pageData = await fetchInstancesPage(accessToken, currentPageUrl)
    pageData.data.forEach((instance) => {
      const { name, instanceId, createdDate, sshKeys, ipConfig } = instance
      allInstances.push({
        name,
        instanceId,
        createdDate,
        host: ipConfig?.v4?.ip,
        sshKeys,
      })
    })

    currentPageUrl = pageData._links.next
      ? new URL(pageData._links.next, "https://api.contabo.com").href
      : null
  } while (currentPageUrl)

  return allInstances
}

async function displayInstances() {
  try {
    const instances = await getAllInstances()

    await fs.writeFile("./instances.json", JSON.stringify(instances, null, 2))
    // console.log()
  } catch (error) {
    console.error("Error fetching Contabo API:", error)
  }
}

async function fetchAllServers() {
  const fetchQuery = "SELECT * FROM servers"
  try {
    const { rows } = await database.query(fetchQuery)
    return rows // Return all server rows
  } catch (err) {
    console.error("Error fetching servers from database:", err)
    throw err
  }
}

async function checkServers(filePath) {
  try {
    const servers = await fetchAllServers() // Fetch all servers from the database
    const serverHosts = servers.map((server) => server.host) // Create an array of all hosts from the servers

    const data = await fs.readFile(filePath, "utf8") // Read the file asynchronously
    const instances = JSON.parse(data)

    // Filter instances to find matches
    const matchingInstances = instances.filter((instance) =>
      serverHosts.includes(instance.host)
    )

    // Find new instances that are not in the database
    const newInstances = instances.filter(
      (instance) => !serverHosts.includes(instance.host)
    )

    // Log counts
    console.log("Count of Matching Instances:", matchingInstances.length)
    console.log("Count of New Instances:", newInstances.length)

    // Generate servers.json with new instances
    if (newInstances.length > 0) {
      await fs.writeFile("servers.json", JSON.stringify(newInstances, null, 2))
      console.log("servers.json has been created with new instances.")
    }

    return { matchingInstances, newInstances } // Return both arrays for further processing if needed
  } catch (err) {
    console.error("Error checking servers:", err)
    throw err
  }
}

async function addServer({ host, password }) {
  const insertQuery = `
    INSERT INTO servers (host, port, username, password, active)
    VALUES ($1, $2, $3, $4, $5)
  `

  // return database.query(insertQuery, [host, 22, "root", password, true])
  return database.query(insertQuery, [host, 22, "root", password, false])
}

async function processServers(filePath) {
  const absolutePath = path.resolve(filePath)
  console.log("Processing servers from:", absolutePath)

  try {
    const data = await fs.readFile(absolutePath, "utf8")
    const lines = data.split("\n")
    for (const line of lines) {
      if (!line.trim()) continue

      const [host, password] = line.split(",").map((part) => part.trim())
      await addServer({ host, password })
      console.log(`Server added for ${host}`)
    }
    console.log("All servers have been processed.")
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error("File not found:", absolutePath)
    } else {
      console.error("Failed to process servers:", error)
    }
  }
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

          await fs.appendFileSync(
            logFilePath,
            `${server.host},${newPassword}\n`
          )

          await sshClient.disconnect()
        } catch (error) {
          console.error(`Failed to change password for ${server.host}:`, error)
          await fs.appendFileSync(
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

async function findPasswords(
  filePath,
  passwords,
  logFilePath,
  passwordLimit = 30
) {
  const errorLogPath = "./passwords_error.log"
  const passwordUsage = passwords.reduce(
    (acc, pwd) => ({ ...acc, [pwd]: 0 }),
    {}
  )

  try {
    const data = await fs.readFile(filePath, "utf8")
    const servers = JSON.parse(data)

    const old_data = await fs.readFile("./passwords.log", "utf8")
    // passwords.log is a csv file with host and password
    const old_servers = old_data.split("\n").map((line) => line.split(",")[0])
    // console.log("Old passwords:", old_servers)

    for (const server of servers) {
      let passwordChanged = false

      if (old_servers.includes(server.host)) {
        console.log("Password already changed for", server.host)
        continue
      }

      // for (const password of Object.keys(passwordUsage)) {
      //   if (passwordUsage[password] >= passwordLimit) {
      //     continue // Skip this password as its limit has been reached
      //   }

      //   console.log("Attempting to connect to", server.host, "using", password)
      //   const sshClient = new SSH(server.host, "22", "root", password)

      //   try {
      //     await sshClient.connect()
      //     const newPassword = generateRandomPassword()

      //     await sshClient.executeCommand(
      //       `echo 'root:${newPassword}' | chpasswd`
      //     )
      //     console.log(`Password changed for ${server.host} using ${password}`)

      //     await fs.appendFile(logFilePath, `${server.host},${newPassword}\n`)
      //     passwordUsage[password] += 1 // Increment usage counter for this password

      //     if (passwordUsage[password] >= passwordLimit) {
      //       console.log(
      //         `Password limit reached for ${password}, removing from rotation.`
      //       )
      //       delete passwordUsage[password] // Remove password from rotation as its limit has been reached
      //     }

      //     await sshClient.disconnect()
      //     passwordChanged = true
      //     break // Exit the password loop on success
      //   } catch (error) {
      //     console.error(
      //       `Failed to change password for ${server.host} using ${password}:`
      //     )
      //     // Connection failed, try next password
      //   } finally {
      //     await sshClient.disconnect() // Ensure disconnection in case of failure
      //   }
      // }

      if (!passwordChanged) {
        console.error(
          `Failed to change password for ${server.host}: All provided passwords failed or limits reached.`
        )
        await fs.appendFile(errorLogPath, `${server.host}\n`)
      }
    }

    console.log("All servers have been processed for password change.")
  } catch (error) {
    console.error(
      "Error processing the JSON file or changing passwords:",
      error
    )
  }
}

const potential_passwords = [
  "MagNate4mar1AWXQX991234",
  "MagNate4mar2AWXQX991234",
  "MagNate4mar3AWXQX991234",
  "MagNate4mar4AWXQX991234",
  "MagNate4mar5AWXQX991234",
  "MagNate4mar6AWXQX991234",
  "MagNate4mar7AWXQX991234",
  "MagNate4mar8AWXQX991234",
  "MagNate4mar9AWXQX991234",
  "MagNate4mar10AWXQX991234",
  "MagNate4mar11AWXQX991234",
  "MagNate4mar12AWXQX998812",
  "MagNate4mar13AWXQX998812",
  "MagNate4mar14AWXQX998812",
  "MagNate4mar15AWXQX998812",
  "MagNate4mar16AWXQX998812",
  "MagNate4mar17AWXQX998812",
  "MagNate4mar18AWXQX998812ZZWE",
  "MagNate4mar19AWXQX998812ZZWE",
  "MagNate4mar20AWXQX997812ZZWE",
  "MagNate4mar21AWXQX997812ZZWE",
  "MagNate4mar22AghdXQX997812ZZWE",
  "MagNate4mar23AghdXQX997812ZZWE",
  "MagNate4mar24AghdXQX997812ZZWE",
  "MagNate4mar25AghdXQX997812ZZWE",
  "MagNate4mar26BghdXQX997812ZZWE",
  "MagNate4mar27BghdXQX997812ZZWE",
  "MagNate4mar28BghdXQX997812ZZWE",
  "MagNate4mar29BghdXQX997812ZZWE",
  "MagNate4mar30WghdXQX997812ZZWE",
]

async function checkServers2() {
  try {
    const servers = await fetchAllServers() // Fetch all servers from the database
    const serverHosts = servers.map((server) => server.host) // Create an array of all hosts from the servers

    const data = await fs.readFile("./passwords_error.log", "utf8") // Read the file asynchronously
    const instances = data.split("\n").map((line) => line.trim())

    // Filter instances to find matches
    const matchingInstances = instances.filter((instance) =>
      serverHosts.includes(instance.host)
    )

    // Find new instances that are not in the database
    const newInstances = instances.filter(
      (instance) => !serverHosts.includes(instance.host)
    )

    // Log counts
    console.log("Count of Matching Instances:", matchingInstances.length)
    console.log("Count of New Instances:", newInstances.length)

    // // Generate servers.json with new instances
    // if (newInstances.length > 0) {
    //   await fs.writeFile("servers.json", JSON.stringify(newInstances, null, 2))
    //   console.log("servers.json has been created with new instances.")
    // }

    return { matchingInstances, newInstances } // Return both arrays for further processing if needed
  } catch (err) {
    console.error("Error checking servers:", err)
    throw err
  }
}

// checkServers2()

// await findPasswords("./servers.json", potential_passwords, "./passwords.log")

// console.log from contabo VPS page
// var rowsData = [];
// $('tr').each(function() {
//     var $row = $(this); // Cache the current row in a jQuery object
//     var rowData = {
//         host: $row.data('vpsip'),
//         port: '22',
//         username: 'root',
//         password: '4xinK103J',
//     };

//     if(rowData.host) {
//         rowsData.push(rowData);
//     }
// });
// console.log(rowsData);

// Get all instances from contabo
// creates instances.json
// displayInstances()

// Check for matching servers in db
// creates servers.json
// checkServers("./instances.json")

await processServers("./passwords.log")

// changePasswords("./servers.json", "./passwords.log")
