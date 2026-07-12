import { broker } from '../config/broker';
import { updateLastSeen } from '../repositories/user.repository';
import logger from '../config/logger';

const MAX_RETRIES = 5;

export const initChatSubscriber = async () => {
    if (!broker) {
        logger.error('Broker not initialized');
        return;
    }

    const queueName = 'user.presence.events';
    const routingKeys = ['chat.user.offline'];

    await broker.consume(queueName, routingKeys, async (payload: any, ack: () => void, nack: () => void) => {
        let success = false;
        let attempt = 0;
        while (attempt < MAX_RETRIES && !success) {
            try {
                logger.info('Handling chat presence event', { userId: payload.userId });
                await updateLastSeen(payload.userId, new Date(payload.timestamp));
                success = true;
                ack();
            } catch (err: any) {
                attempt++;
                logger.warn('Failed to process chat presence event Retrying... attempt: ' + attempt, { error: err.message });
                if (attempt < MAX_RETRIES) {
                    await new Promise((r) => { setTimeout(r, attempt * 1000) })
                }
            }
        }
        if (success) {
            ack();
        } else {
            logger.error('Max retries exhausted, dropping event', { userId: payload.userId });
            nack();
        }

    });

    logger.info('Subscribed to RabbitMQ', { queue: queueName, routingKeys });
}
