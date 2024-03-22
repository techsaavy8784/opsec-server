import dotenv from "dotenv"
dotenv.config()

import { http, createPublicClient } from "viem"
import abi from "../utils/abi.json" assert { type: "json" }

export const publicClient = createPublicClient({
  cacheTime: 0,
  transport: http(process.env.RPC_URL),
})

const BLOCK_INTERVAL = 3

const listenStake = async () => {
  let lastBlockNumber = await publicClient.getBlockNumber()

  console.log(`start: ${lastBlockNumber}`)

  setInterval(async () => {
    try {
      const blockNumber = Number(await publicClient.getBlockNumber())

      console.log(`block number: ${blockNumber}`)

      if (blockNumber - BLOCK_INTERVAL < lastBlockNumber) {
        console.log(`skipping ${blockNumber}`)
        return
      }

      lastBlockNumber = blockNumber

      console.log(
        `block number: from ${
          blockNumber - BLOCK_INTERVAL + 1
        } to ${lastBlockNumber}`
      )

      const filter = await publicClient.createContractEventFilter({
        abi,
        address: process.env.STAKE_CONTRACT,
        eventName: "Staked",
        fromBlock: blockNumber - BLOCK_INTERVAL + 1,
        toBlock: blockNumber,
      })

      const logs = await publicClient.getFilterLogs({ filter })

      for (const log of logs) {
        const stakeId = log.args.stakeId

        console.log(`Stake event: ${stakeId}`)

        fetch(`${process.env.OPSEC_DAPP_URL}/api/staking/complete`, {
          body: JSON.stringify({ stakeId }),
          method: "POST",
          headers: {
            "X-API-KEY": process.env.STAKE_WEBHOOK_KEY,
          },
        }).then((res) =>
          console.log(`Stake complete status: ${stakeId}, ${res.status}`)
        )
      }
    } catch (e) {
      console.error(`error: ${JSON.stringify(e)}`)
    }
  }, 5000)
}

listenStake()
