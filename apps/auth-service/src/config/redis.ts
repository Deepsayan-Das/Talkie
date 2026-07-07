import Redis from 'ioredis';
import env from './env';

const redis = new Redis({
    host: env.redis_host,
    port: env.redis_port,
    db: env.redis_db,
})

redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('error', (err) => console.error('[Redis] Error:', err));

export default redis;
