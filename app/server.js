import dotenv from "dotenv"
import express from "express"
import bodyParser from "body-parser"
import cors from "cors"
import listenStake from "./web3.js"

const app = express()

dotenv.config()
// const auditRoute = require('./api/audit');

const port = 9898

app.use(express.json())
app.use(cors())

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

const router = express.Router()

router.get("/ping", (req, res) => {
  res.status(200).json({ result: "pong" })
})

// app.use("/dashboard", dashboardRoute)

async function init() {
  try {
    console.log("Initializing...")

    // await Promise.all([
    //   initDashboardLive(),
    //   initDashboardTrending(),
    //   initBounty(),
    //   initAttacks(),
    // ]);

    console.log("Initialization complete.")

    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`)
    })
  } catch (error) {
    console.error("Failed to initialize:", error)
    process.exit(1)
  }
}

init()

listenStake()
