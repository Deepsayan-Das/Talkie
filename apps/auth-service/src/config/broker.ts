import { createMessageBroker } from '@talkie/shared-utils';
import logger from './logger';

export let broker: any = null;

export const initBroker = async () => {
    try {
        broker = await createMessageBroker('auth-service');
        logger.info('Message broker initialized in auth-service');
    } catch (err) {
        logger.error('Failed to initialize message broker in auth-service', err);
        throw err;
    }
};
