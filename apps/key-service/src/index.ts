import { app } from "./app";
import logger from "./config/logger";
import { initBroker } from "./config/broker";
import db from "./db/knex";

const PORT = process.env.PORT || 3008;

async function bootstrap() {
    try {
        await db.raw("SELECT 1");
        logger.info("Database connected");

        await initBroker();

        app.listen(PORT, () => {
            logger.info(`Key service listening on port ${PORT}`);
        });
    } catch (error: any) {
        logger.error("Failed to start key service", { error: error.message });
        process.exit(1);
    }
}

bootstrap();
