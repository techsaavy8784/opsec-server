import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

dotenv.config()

import { http, createPublicClient } from "viem"
import abi from "../utils/abi.json" assert { type: "json" }

export const publicClient = createPublicClient({
  cacheTime: 0,
  transport: http(process.env.RPC_URL),
})

const BLOCK_INTERVAL = 3

const SAVE_FILE_PATH = path.join(process.env.HOME, ".opsec")

const listenStake = async () => {
  let lastBlockNumber = 0

  if (fs.existsSync(SAVE_FILE_PATH)) {
    lastBlockNumber = Number(fs.readFileSync(SAVE_FILE_PATH))
  }

  if (lastBlockNumber === 0) {
    lastBlockNumber = await publicClient.getBlockNumber()
  }

  console.log(`start: ${lastBlockNumber}`)

  setInterval(async () => {
    try {
      const blockNumber = Number(await publicClient.getBlockNumber())

      console.log(`block number: ${blockNumber}`)

      if (blockNumber - BLOCK_INTERVAL < lastBlockNumber) {
        console.log(`skipping ${blockNumber}`)
        return
      }

      console.log(`block number: from ${lastBlockNumber} to ${blockNumber}`)

      const filter = await publicClient.createContractEventFilter({
        abi,
        address: process.env.STAKE_CONTRACT,
        fromBlock: lastBlockNumber,
        toBlock: blockNumber,
      })

      const logs = await publicClient.getFilterLogs({ filter })

      for (const log of logs) {
        const { stakeId, address } = log.args

        if (log.eventName === "Staked") {
          console.log(`Stake event: ${stakeId}`)

          fetch(`${process.env.OPSEC_DAPP_URL}/api/staking/add`, {
            body: JSON.stringify({ stakeId, address }),
            method: "POST",
            headers: {
              "X-API-KEY": process.env.STAKE_WEBHOOK_KEY,
            },
          }).then((res) =>
            console.log(`Stake add status: ${stakeId}, ${res.status}`)
          )
        } else if (log.eventName === "Extended") {
          console.log(`Extend event: ${stakeId}`)

          fetch(`${process.env.OPSEC_DAPP_URL}/api/staking/extend`, {
            body: JSON.stringify({ stakeId }),
            method: "POST",
            headers: {
              "X-API-KEY": process.env.STAKE_WEBHOOK_KEY,
            },
          }).then((res) =>
            console.log(`Stake extend status: ${stakeId}, ${res.status}`)
          )
        }
      }

      lastBlockNumber = blockNumber + 1
      console.log(`last block number: ${lastBlockNumber}`)
      fs.writeFileSync(SAVE_FILE_PATH, String(lastBlockNumber))
    } catch (e) {
      console.error(`error: ${JSON.stringify(e)}`)
    }
  }, 5000)
}

listenStake()
