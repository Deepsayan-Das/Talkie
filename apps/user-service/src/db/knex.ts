import Knex from 'knex'
import env from '../config/env'
import path from 'path'

const db = Knex({
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
        directory: path.join(__dirname, 'migrations'),
    },
})

export default db
