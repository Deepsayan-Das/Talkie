import redis from '../config/redis';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const BLACKLIST_PREFIX = 'blacklist:';

/**
 * Blacklists an accessToken in Redis until it naturally expires.
 * The TTL is derived from the token's own `exp` claim so Redis
 * automatically cleans it up — no stale keys linger forever.
 */
export const blacklistToken = async (token: string): Promise<void> => {
    let ttlSeconds: number;
    try {
        const decoded = jwt.decode(token) as { exp?: number } | null;
        if (!decoded?.exp) {
            // If there's no exp claim default to 15 minutes
            ttlSeconds = 15 * 60;
        } else {
            ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000);
        }
    } catch {
        ttlSeconds = 15 * 60;
    }

    if (ttlSeconds > 0) {
        const tokenKey = crypto.createHash('sha256').update(token).digest('hex')
        await redis.set(`${BLACKLIST_PREFIX}${tokenKey}`, '1', 'EX', ttlSeconds)
    }
};

/**
 * Returns true if the token has been blacklisted (i.e. the user has logged out).
 */
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
    const result = await redis.exists(`${BLACKLIST_PREFIX}${token}`);
    return result === 1;
};
