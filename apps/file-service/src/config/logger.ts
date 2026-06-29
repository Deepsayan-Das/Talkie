import { createLogger } from 'shared-utils';

/**
 * File-service logger.
 *
 * Usage:
 *   import logger from '../config/logger';
 *   logger.info('File uploaded', { ownerId, fileKey, size });
 *   logger.warn('Unauthorized delete attempt', { fileId, requesterId });
 *   logger.error('S3 upload failed', { error: err.message });
 */
const logger = createLogger('file-service');

export default logger;
