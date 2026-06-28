import dotenv from 'dotenv';
dotenv.config();

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
};

const env = {
  port: parseInt(process.env.PORT || '3004'),
  db: {
    host: required('DB_HOST'),
    port: parseInt(process.env.DB_PORT || '5432'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    name: required('DB_NAME'),
  },
  minio: {
    endpoint: required('MINIO_ENDPOINT'),
    port: parseInt(process.env.MINIO_PORT || '9000'),
    access_key: required('MINIO_ACCESS_KEY'),
    secret_key: required('MINIO_SECRET_KEY'),
    bucket: required('MINIO_BUCKET'),
    use_ssl: process.env.MINIO_USE_SSL === 'true',
  },
};

export default env;
