import { logger } from '../audit/logger.js';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly maxReadTokens: number;
  private readonly maxWriteTokens: number;
  private readonly readRefillRate: number; // tokens per ms
  private readonly writeRefillRate: number; // tokens per ms

  constructor() {
    const limitRead = parseInt(process.env.RATE_LIMIT_READ || '30', 10);
    const limitWrite = parseInt(process.env.RATE_LIMIT_WRITE || '10', 10);

    this.maxReadTokens = limitRead;
    this.maxWriteTokens = limitWrite;
    this.readRefillRate = limitRead / 60000; // Refill over 1 minute
    this.writeRefillRate = limitWrite / 60000;
  }

  /**
   * Asserts rate limit for a tool. Throws an error if limited.
   */
  public assertLimit(toolName: string): void {
    const isWrite = toolName.startsWith('create_') || 
                    toolName.startsWith('update_') || 
                    toolName.startsWith('delete_') ||
                    toolName.startsWith('start_') ||
                    toolName.startsWith('stop_') ||
                    toolName.startsWith('log_') ||
                    toolName.startsWith('add_') ||
                    toolName.startsWith('assign_');

    const maxTokens = isWrite ? this.maxWriteTokens : this.maxReadTokens;
    const refillRate = isWrite ? this.writeRefillRate : this.readRefillRate;

    const now = Date.now();
    let bucket = this.buckets.get(toolName);

    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: now };
      this.buckets.set(toolName, bucket);
    } else {
      // Refill tokens based on elapsed time
      const elapsed = now - bucket.lastRefill;
      const refilled = elapsed * refillRate;
      bucket.tokens = Math.min(maxTokens, bucket.tokens + refilled);
      bucket.lastRefill = now;
    }

    if (bucket.tokens < 1) {
      logger.warn({ toolName, tokensRemaining: bucket.tokens }, 'Rate limit exceeded for tool');
      throw new Error(`Rate limit exceeded for tool "${toolName}". Please slow down requests.`);
    }

    bucket.tokens -= 1;
    logger.debug({ toolName, tokensRemaining: bucket.tokens }, 'Token consumed from rate limiter');
  }
}
