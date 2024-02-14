import dotenv from "dotenv"
dotenv.config({ path: "../.env" })
import pkg from "pg"
const { Pool } = pkg

const connectionString = process.env.SUPABASE

const database = new Pool({
  connectionString,
})

export default database
