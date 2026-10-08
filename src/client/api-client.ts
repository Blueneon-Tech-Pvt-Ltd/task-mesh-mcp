import axios, { AxiosInstance } from 'axios';
import { logger } from '../audit/logger.js';
import { envConfig } from '../config/envconfig.js';

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = envConfig.apiUrl;
    const token = envConfig.apiToken;

    if (!token) {
      logger.error('TASKMESH_API_TOKEN environment variable is not defined.');
      // We don't crash immediately here, but requests will fail.
    }

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      timeout: 10000,
    });

    // Request/Response logging interceptors
    this.client.interceptors.request.use((config) => {
      (config as any).metadata = { startTime: Date.now() };
      logger.info({ method: config.method, url: config.url }, 'Sending request to TaskMesh API');
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config as any).metadata.startTime;
        logger.info(
          {
            method: response.config.method,
            url: response.config.url,
            status: response.status,
            durationMs: duration,
          },
          'Received response from TaskMesh API'
        );
        return response;
      },
      (error) => {
        const duration = error.config?.metadata?.startTime
          ? Date.now() - error.config.metadata.startTime
          : 0;

        const responseStatus = error.response?.status;
        const responseData = error.response?.data;

        logger.error(
          {
            method: error.config?.method,
            url: error.config?.url,
            status: responseStatus,
            error: error.message,
            responseData,
            durationMs: duration,
          },
          'TaskMesh API request failed'
        );

        // Map status codes to user-friendly messages
        if (responseStatus === 401) {
          throw new Error('Authentication failed: Invalid or expired TASKMESH_API_TOKEN.');
        } else if (responseStatus === 403) {
          const detail = responseData?.message || 'Access Denied';
          throw new Error(`Forbidden: You do not have permission/scope for this action. Detail: ${detail}`);
        } else if (responseStatus === 404) {
          throw new Error('Resource not found on TaskMesh server.');
        } else if (responseData?.message) {
          // Surfacing NestJS ValidationPipe errors or domain business logic exceptions
          const detail = Array.isArray(responseData.message)
            ? responseData.message.join(', ')
            : responseData.message;
          throw new Error(`API Error: ${detail}`);
        }

        throw error;
      }
    );
  }

  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }
}
