import { http, createPublicClient } from "viem"
import { mainnet, sepolia } from "viem/chains"
import abi from "../utils/abi.json" assert { type: "json" }

export const publicClient = createPublicClient({
  chain: process.env.NODE_ENV === "production" ? mainnet : sepolia,
  cacheTime: 0,
  transport: http(),
})

const BLOCK_INTERVAL = 3

const listenStake = async () => {
  let lastBlockNumber = await publicClient.getBlockNumber()

  console.log(`start: ${lastBlockNumber}`)

  setInterval(async () => {
    const blockNumber = Number(await publicClient.getBlockNumber())

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
      console.log(`Stake event: ${stakeId}`)
      fetch(`${process.env.OPSEC_DAPP_URL}/api/staking/complete`, {
        body: JSON.stringify({ stakeId: log.args.stakeId }),
        headers: {
          "X-API-KEY": process.env.STAKE_WEBHOOK_KEY,
        },
      }).then((res) =>
        console.log(`Stake complete status: ${stakeId}, ${res.status}`)
      )
    }
  }, 5000)
}

export default listenStake
