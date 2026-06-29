import { createLogger } from 'shared-utils';

/**
 * User-service logger.
 *
 * Usage:
 *   import logger from '../config/logger';
 *   logger.info('Friend request sent', { senderId, receiverId });
 *   logger.warn('User already blocked', { senderId, targetId });
 *   logger.error('Failed to fetch relations', { error: err.message });
 */
const logger = createLogger('user-service');

export default logger;
