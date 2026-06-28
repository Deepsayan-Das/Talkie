import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

module.exports = {
  client: 'pg',
  connection: {
    host: required('DB_HOST'),
    port: parseInt(process.env.DB_PORT || '5432'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
  },
  migrations: {
    extension: 'ts',
    directory: path.join(__dirname, 'src/db/migrations'),
  },
};
