import type { Knex } from 'knex'
import env from './src/config/env'
import path from 'path'

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: {
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
    },
    migrations: {
      extension: 'ts',
      directory: path.join(__dirname, 'src/db/migrations'),
    },
  },
}

export default config
