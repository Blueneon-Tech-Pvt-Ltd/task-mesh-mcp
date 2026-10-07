import * as dotenv from 'dotenv';

dotenv.config();

const DEFAULT_PROD_URL = 'https://crm.bluentech.com.np';

function normalizeApiUrl(url?: string): string {
  let raw = (url || DEFAULT_PROD_URL).trim().replace(/\/+$/, '');
  if (!raw.endsWith('/api/v1')) {
    if (raw.endsWith('/api')) {
      raw += '/v1';
    } else {
      raw += '/api/v1';
    }
  }
  return raw;
}

export const envConfig = {
  apiUrl: normalizeApiUrl(process.env.TASKMESH_API_URL),
  apiToken: process.env.TASKMESH_API_TOKEN || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};
