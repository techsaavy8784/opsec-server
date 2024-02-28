import { Client } from "ssh2"
import fs from "fs"
import path from "path"

class ssh {
  constructor(host, port, username, password) {
    this.conn = new Client()
    this.config = {
      host,
      port,
      username,
      password,
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.conn
        .on("ready", () => {
          console.log("SSH Client Ready")
          resolve()
        })
        .on("error", (err) => {
          reject(err)
        })
        .connect(this.config)
    })
  }

  executeCommand(command, detach = false) {
    return new Promise((resolve, reject) => {
      console.log(`Executing command: ${command}`)
      this.conn.exec(command, (err, stream) => {
        if (err) return reject(err)

        let data = ""

        stream.on("data", (chunk) => {
          process.stdout.write(chunk.toString()) // Stream stdout in real-time
          data += chunk // Accumulate output for final result
        })

        stream.stderr.on("data", (chunk) => {
          process.stderr.write(chunk.toString()) // Stream stderr in real-time
          data += chunk // Optionally accumulate stderr too
        })

        if (!detach) {
          stream.on("close", (code, signal) => {
            if (code === 0) {
              resolve(data) // Resolve with all output after command completion
            } else {
              reject(new Error(`Command exited with code ${code}`))
            }
          })
        } else {
          // In detached mode, resolve immediately without waiting for command completion
          resolve(
            "Command executed in detached mode, output may not be complete."
          )
        }
      })
    })
  }

  checkFileExists(filename) {
    return this.executeCommand(`test -f ${filename} && echo exists || echo no`)
  }

  createDirectory(directory) {
    return this.executeCommand(`mkdir -p ${directory}`)
  }

  changeDirectory(directory) {
    return this.executeCommand(`cd ${directory}`)
  }

  moveFile(source, destination) {
    return this.executeCommand(`mv ${source} ${destination}`)
  }

  changePermissions(file, permissions) {
    return this.executeCommand(`chmod ${permissions} ${file}`)
  }

  deleteFile(file) {
    return this.executeCommand(`rm ${file}`)
  }

  deleteDirectory(directory) {
    return this.executeCommand(`rm -r ${directory}`)
  }

  listDirectoryContents(directory) {
    return this.executeCommand(`ls -lah ${directory}`)
  }

  getHomeDirectory() {
    return this.executeCommand("echo $HOME")
  }

  scpFile(localPath, remotePath) {
    return new Promise((resolve, reject) => {
      console.log(`Attempting to transfer file to ${remotePath}`)
      this.conn.sftp((err, sftp) => {
        if (err) {
          console.error("Failed to initiate SFTP session:", err)
          return reject(err)
        }

        // Verify local file existence before attempting to transfer
        fs.access(localPath, fs.constants.F_OK, (err) => {
          if (err) {
            console.error(
              `Local file does not exist or is not accessible: ${localPath}`,
              err
            )
            return reject(err)
          }

          // Proceed with file transfer
          sftp.fastPut(localPath, remotePath, {}, (err) => {
            if (err) {
              console.error(`Failed to transfer file to ${remotePath}:`, err)
              return reject(err)
            } else {
              console.log(`File successfully transferred to ${remotePath}`)
              resolve()
            }
          })
        })
      })
    })
  }

  async scpDirectory(localDir, remoteDir) {
    const getAllFiles = (dir, fileList = []) => {
      fs.readdirSync(dir).forEach((file) => {
        const filePath = path.join(dir, file)
        if (fs.statSync(filePath).isDirectory()) {
          fileList = getAllFiles(filePath, fileList)
        } else {
          fileList.push(filePath)
        }
      })
      return fileList
    }

    const files = getAllFiles(localDir)

    for (const file of files) {
      const baseName = path.basename(file)
      const remoteFilePath = `${remoteDir}/${baseName}`
      try {
        await this.scpFile(file, remoteFilePath)
      } catch (error) {
        console.error(`Error copying ${file} to ${remoteFilePath}:`, error)
        // return Promise.reject(error);
      }
    }

    return Promise.resolve()
  }

  async disconnect() {
    this.conn.end()
  }
}

export default ssh
