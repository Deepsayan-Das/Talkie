import Redis from 'ioredis';
import logger from './logger';

const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: parseInt(process.env.REDIS_DB || '2'), // Using same DB as Chat Service
    lazyConnect: true,
});

redis.on('error', (err) => {
    logger.error('Redis connection error in User Service:', err);
});

export default redis;
