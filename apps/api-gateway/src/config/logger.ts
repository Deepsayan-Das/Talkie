import { createLogger } from '../../../shared-utils/logger';

/**
 * API-gateway logger.
 *
 * Usage:
 *   import logger from '../config/logger';
 *   logger.info('Gateway started', { port });
 *   logger.warn('Rate limit exceeded', { ip, route });
 *   logger.error('Proxy error', { target, error: err.message });
 */
const logger = createLogger('api-gateway');

export default logger;
