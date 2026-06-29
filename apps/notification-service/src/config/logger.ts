import { createLogger } from '../../../shared-utils/logger';

/**
 * Notification-service logger.
 *
 * Usage:
 *   import logger from '../config/logger';
 *   logger.info('Verification email sent', { to: email });
 *   logger.error('Failed to send email', { error: err.message });
 */
const logger = createLogger('notification-service');

export default logger;
