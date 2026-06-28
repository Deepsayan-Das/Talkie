import redis from '../config/redis';
import { sendVerificationMail } from '../handlers/email.handler';

export const initAuthSubscriber = async () => {
    await redis.subscribe('auth.user.registered', 'auth.verification.resend');

    redis.on('message', async (channel, message) => {
        const payload = JSON.parse(message);

        if (channel === 'auth.user.registered') {
            await sendVerificationMail(payload.email, payload.verificationLink);
        }
        if (channel === 'auth.verification.resend') {
            await sendVerificationMail(payload.email, payload.verificationLink);
        }
    });
}