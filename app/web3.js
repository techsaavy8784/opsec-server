import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"
import nodeCron from "node-cron"

dotenv.config()

import { CovalentClient } from "@covalenthq/client-sdk";
import { http, createPublicClient, createWalletClient, custom } from "viem"
import { mainnet } from 'viem/chains'
import abi from "../utils/abi.json" assert { type: "json" }

const restrict_check = async (address) => {
  const client = new CovalentClient(process.env.COVALENT_API_KEY);
  const resp = await client.BalanceService.getHistoricalPortfolioForWalletAddress("eth-mainnet",address, {"days": 10});
  const datas = resp.data.items[0].holdings;
  for (let i = 1; i < datas.length; i++) {
      if (datas[i].open.balance < datas[i - 1].open.balance) {
        return false;
      }
  }
  return true
}

export const publicClient = createPublicClient({
  cacheTime: 0,
  transport: http(process.env.RPC_URL),
})

export const walletClient = createWalletClient({
  chain: mainnet,
  // transport: custom(window.ethereum!)
  transport: http()
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
        eventName: "Staked",
        fromBlock: lastBlockNumber,
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

      lastBlockNumber = blockNumber + 1
      console.log(`last block number: ${lastBlockNumber}`)
      fs.writeFileSync(SAVE_FILE_PATH, String(lastBlockNumber))
    } catch (e) {
      console.error(`error: ${JSON.stringify(e)}`)
    }
  }, 5000)
}

const listenClaim = ()  => {
  let addressParam = []
  let amountParam = []
  let userIdParam = []
  fetch(`${process.env.OPSEC_DAPP_URL}/api/claim/all`, {
    body: JSON.stringify({ stakeId }),
    method: "GET",
    headers: {
      "X-API-KEY": process.env.STAKE_WEBHOOK_KEY,
    },
  }).then((res) => res.json())
    .then(async (res) =>{
      console.log(`claim datas: ${res.data}`)

      res.data.map(async (item, id) => {
        userIdParam.push(item.user_id)
        if(!restrict_check(item.address))
          return;
        addressParam.push(item.address)
        amountParam.push(item.amount)
        return;
      })

      try {

        const { request } = await publicClient.simulateContract({
          // account: walletClient.requestAddresses(),
          account: process.env.OWER_ACCOUNT,
          address: process.env.STAKE_CONTRACT,
          abi,
          functionName: 'claim',
          args: [ 
            addressParam,
            amountParam
          ]
        })

        await walletClient.writeContract(request)

        userIdParam.map(async (item) => {
          await fetch(`${process.env.OPSEC_DAPP_URL}/api/claim/update`, {
            body: JSON.stringify({ userId: item }),
            method: "POST",
            headers: {
              "X-API-KEY": process.env.STAKE_WEBHOOK_KEY,
            },
          })
        })
      } catch(e) {
        console.log("error: ", e);
      }
      
    }
  )
}

listenStake()

// for test, period of cron job is 20s. for 24hr  '0 0 * * *'
const job = nodeCron.schedule('*/20 * * * * *', listenClaim);
job.start();