import dotenv from 'dotenv'
dotenv.config()


const required = (key: string): string => {
    const val = process.env[key]
    if (!val)
        throw new Error(`Missing required environment variable: ${key}`)
    return val;
}

const env = {
    port: parseInt(process.env.PORT || '3003'),
    cors_origin: required('CORS_ORIGIN'),
    jwt_secret: required('JWT_SECRET'),
    auth_service_url: required('AUTH_SERVICE_URL'),
    user_service_url: required('USER_SERVICE_URL'),
    chat_service_url: required('CHAT_SERVICE_URL'),
    file_service_url: required('FILE_SERVICE_URL'),
    notification_service_url: required('NOTIFICATION_SERVICE_URL'),
    key_service_url: process.env.KEY_SERVICE_URL || 'http://localhost:3008',
}

export default env

/* 
PORT=3003
CORS_ORIGIN=http://localhost:3000
*/