import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"
import nodeCron from "node-cron"
import database from "../utils/db.js"

dotenv.config()

import { CovalentClient } from "@covalenthq/client-sdk";
import { http, createPublicClient, createWalletClient } from "viem"
import { mainnet,sepolia } from 'viem/chains'
import abi from "../utils/abi.json" assert { type: "json" }

const selectedChain = process.env.NODE_ENV === 'production' ? mainnet : sepolia;

/*
  check if restriction for requesting reflection claim
  @param address

  this function check if user sold user's opsec token within 10 days.
*/
const restrict_check = async (address) => {
  const client = new CovalentClient(process.env.COVALENT_API_KEY);
  const resp = await client.BalanceService.getHistoricalPortfolioForWalletAddress("eth-mainnet",address, {"days": 10});
  const data = resp.data.items[0].holdings;
  for (let i = 1; i < data.length; i++) {
      if (data[i].open.balance < data[i - 1].open.balance) {
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
  chain: selectedChain,
  transport: http(process.env.RPC_URL)
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
        const { stakeId, user } = log.args

        if (log.eventName === "Staked") {
          console.log(`Stake event: ${stakeId}, ${user}`)

          fetch(`${process.env.OPSEC_DAPP_URL}/api/staking/add`, {
            body: JSON.stringify({ stakeId, address: user }),
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


const batchClaim = ()  => {
  const addressParam = []
  const amountParam = []
  const userIdParam = []

  const sqlQuery = `
      SELECT
        *
      FROM claims;
    `
  database.query(sqlQuery)
    .then(async (res) =>{
      console.log(`claim datas: ${res.rows}`)

      res.rows.forEach(async (item) => {
        userIdParam.push(item.user_id)
        if(restrict_check(item.address)){
          addressParam.push(item.address)
          amountParam.push(item.amount)
        }
      })

      try {

        const { request } = await publicClient.simulateContract({
          account: process.env.OWNER_ACCOUNT,
          address: process.env.STAKE_CONTRACT,
          abi,
          functionName: 'claim',
          args: [ 
            amountParam,
            addressParam
          ]
        })

        await walletClient.writeContract(request)

        const userIds = userIdParam.join(','); // Convert array to comma-separated string

        const sqlDeleteQuery = `
            DELETE
            FROM claims
            WHERE user_id IN ($1)
            ;`;
        const values = [userIds]
        await database.query(sqlDeleteQuery, values);

      } catch(e) {
        console.log("error: ", e);
      }
    }
  )
}

listenStake()

// // for test, period of cron job is 20s '*/60 * * * * *' . for 24hr  '0 0 * * *'
const job = nodeCron.schedule('0 0 * * *', batchClaim);
job.start();