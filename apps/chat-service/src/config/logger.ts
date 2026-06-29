import { createLogger } from '../../../shared-utils/logger';

/**
 * Chat-service logger.
 *
 * Usage:
 *   import logger from '../config/logger';
 *   logger.info('User connected', { socketId, userId });
 *   logger.warn('Unauthorized socket connection attempt');
 *   logger.error('Failed to send message', { roomId, error: err.message });
 */
const logger = createLogger('chat-service');

export default logger;
