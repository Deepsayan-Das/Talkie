import { createLogger } from '@talkie/shared-utils';

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
