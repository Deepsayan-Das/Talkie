import redis from '../config/redis';
import { sendVerificationMail } from '../handlers/email.handler';
import logger from '../config/logger';

export const initAuthSubscriber = async () => {
    await redis.subscribe('auth.user.registered', 'auth.verification.resend');
    logger.info('Subscribed to Redis channels', { channels: ['auth.user.registered', 'auth.verification.resend'] });

    redis.on('message', async (channel, message) => {
        logger.info('Redis message received', { channel });
        try {
            const payload = JSON.parse(message);

            if (channel === 'auth.user.registered') {
                logger.info('Handling auth.user.registered event', { email: payload.email });
                await sendVerificationMail(payload.email, payload.verificationLink);
            }
            if (channel === 'auth.verification.resend') {
                logger.info('Handling auth.verification.resend event', { email: payload.email });
                await sendVerificationMail(payload.email, payload.verificationLink);
            }
        } catch (err: any) {
            logger.error('Failed to process Redis message', { channel, error: err.message });
        }
    });
}