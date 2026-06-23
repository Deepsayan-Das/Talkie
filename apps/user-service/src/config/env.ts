import { config } from 'dotenv'
config()

const required = (key: string): string => {
  const val = process.env[key]
  if (!val)
    throw new Error(`Missing required environment variable: ${key}`)
  return val
}

const env = {
  port: parseInt(process.env.PORT || '3002'),
  db: {
    host: required('DB_HOST'),
    port: parseInt(process.env.DB_PORT || '5432'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    name: required('DB_NAME'),
  },
  jwt_secret: required('JWT_SECRET'),
}

export default env

/* .env example
PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_USER=talkie-admin
DB_PASSWORD=postgres
DB_NAME=user_db
JWT_SECRET=keepYappin'Buddy
*/
