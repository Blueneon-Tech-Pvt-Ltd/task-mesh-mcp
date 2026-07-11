import pino from 'pino';

// IMPORTANT: We must log only to stderr because stdout is reserved
// for the MCP JSON-RPC protocol messages.
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino/file',
    options: {
      destination: 2, // 2 is file descriptor for stderr
    },
  },
});
