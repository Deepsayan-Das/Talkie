import dotenv from 'dotenv';
dotenv.config();


const required = (key: string): string => {
  const val = process.env[key]
  if (!val)
    throw new Error(`Missing required environment variable: ${key}`)
  return val;
}

const env = {
  port: parseInt(process.env.PORT || '3001'),
  db: {
    host: required('DB_HOST'),
    port: parseInt(process.env.DB_PORT || '5432'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    name: required('DB_NAME'),
  },
  jwt_secret: required('JWT_SECRET'),
  jwt_expires_in: (process.env.JWT_EXPIRES_IN || '15m') as string,
  refresh_token_expires_in: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  redis_host: required('REDIS_HOST'),
  redis_port: parseInt(process.env.REDIS_PORT || '6379'),
  redis_db: parseInt(process.env.REDIS_DB || '0'),
  salt_rounds: parseInt(process.env.SALT_ROUNDS || '10'),
  client_url: required('CLIENT_URL')
}
export default env


/* PORT=3001
DATABASE_URL=postgres://talkie-admin:postgres@localhost:5432/auth_db
JWT_SECRET=keepYappin'Buddy
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
REDIS_URL=redis://localhost:6379
REDIS_DB=0 */