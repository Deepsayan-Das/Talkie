import { broker } from '../config/broker';
import { sendVerificationMail } from '../handlers/email.handler';
import logger from '../config/logger';

const MAX_RETRIES = 5;

export const initAuthSubscriber = async () => {
    if (!broker) {
        logger.error('Broker not initialized');
        return;
    }

    const queueName = 'notification.auth.events';
    const routingKeys = ['auth.user.registered', 'auth.verification.resend'];

    await broker.consume(queueName, routingKeys, async (payload: any, ack: () => void, nack: () => void) => {
        let success = false;
        let attempt = 0;
        while (attempt < MAX_RETRIES && !success) {
            try {
                logger.info('Handling auth event', { email: payload.email });
                await sendVerificationMail(payload.email, payload.verificationLink);
                success = true;
            } catch (err: any) {
                attempt++;
                logger.warn('Failed to process auth event Retrying... attempt: ' + attempt, { error: err.message });
                if (attempt < MAX_RETRIES) {
                    await new Promise((r) => { setTimeout(r, attempt * 1000) })
                }
            }
        }
        if (success) {
            ack();
        } else {
            logger.error('Max retries exhausted, dropping event', { email: payload.email });
            nack();
        }

    });

    logger.info('Subscribed to RabbitMQ', { queue: queueName, routingKeys });
}