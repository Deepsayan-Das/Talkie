import { createMessageBroker } from '@talkie/shared-utils';
import logger from './logger';

export let broker: any = null;

export const initBroker = async () => {
    try {
        broker = await createMessageBroker('notification-service');
        logger.info('Message broker initialized in notification-service');
    } catch (err) {
        logger.error('Failed to initialize message broker in notification-service', err);
        throw err;
    }
};
