import { createMessageBroker } from '@talkie/shared-utils';
import logger from './logger';

export let broker: any = null;

export const initBroker = async () => {
    try {
        broker = await createMessageBroker('chat-service');
        logger.info('Message broker initialized in chat-service');
    } catch (err) {
        logger.error('Failed to initialize message broker in chat-service', err);
        throw err;
    }
};
