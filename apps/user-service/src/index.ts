import express from 'express'
import env from './config/env'
import db from './db/knex'
import router from './routes/user.routes'
const app = express()

app.use(express.json())



// TODO: mount user router
app.use('/api/v1/user', router)

const startup = async () => {
    try {
        await db.raw('SELECT 1')
        console.log('Database connection established')
        app.listen(env.port, () => {
            console.log(`User service is running on port ${env.port}`)
        })
    } catch (err) {
        console.error('Database connection failed:', err)
        process.exit(1)
    }
}

startup()
