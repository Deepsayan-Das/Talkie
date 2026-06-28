import dotenv from 'dotenv';
dotenv.config();

const required = (key: string): string => {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required environment variable: ${key}`);
    return val;
};

const env = {
    port: parseInt(process.env.PORT || '3007'),
    redis_host: required('REDIS_HOST'),
    redis_port: parseInt(process.env.REDIS_PORT || '6379'),
    redis_db: parseInt(process.env.REDIS_DB || '0'),
};

export default env;
