import express from 'express'
import env from './config/env'
import db from './db/knex'
import router from './routes/user.routes'
import logger from './config/logger'
import { metrics } from './config/metrics'
const app = express()

app.use(express.json())



// TODO: mount user router
app.use('/api/v1/user', router)
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.send(await metrics.register.metrics());
});

const startup = async () => {
    try {
        await db.raw('SELECT 1')
        logger.info('Database connection established')
        app.listen(env.port, () => {
            logger.info(`User service is running on port ${env.port}`)
        })
    } catch (err) {
        logger.error('Database connection failed', { error: (err as Error).message })
        process.exit(1)
    }
}

startup()
