import { createMessageBroker } from '@talkie/shared-utils';
import logger from './logger';

export let broker: any = null;

export const initBroker = async () => {
    try {
        broker = await createMessageBroker('user-service');
        logger.info('Message broker initialized in user-service');
    } catch (err) {
        logger.error('Failed to initialize message broker in user-service', err);
        throw err;
    }
};
