import { fileURLToPath } from "url"
import pkg from "pg"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log(path.join(__dirname, "..", ".env"))

const { Pool } = pkg

const connectionString = process.env.SUPABASE

const database = new Pool({
  connectionString,
})

export default database
