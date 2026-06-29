import { createLogger } from '../../../shared-utils/logger';

/**
 * Auth-service logger.
 *
 * Usage:
 *   import logger from '../config/logger';
 *   logger.info('User registered', { userId });
 *   logger.error('Registration failed', { error: err.message });
 */
const logger = createLogger('auth-service');

export default logger;
