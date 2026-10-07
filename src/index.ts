import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ApiClient } from './client/api-client.js';
import { EntityResolver } from './client/resolver.js';
import { RateLimiter } from './rate-limiter/limiter.js';
import { logger } from './audit/logger.js';
import { registerAllTools } from './tools/index.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create API Client, Resolver, and Rate Limiter
const api = new ApiClient();
const resolver = new EntityResolver(api);
const limiter = new RateLimiter();

// Create the MCP server
const server = new Server(
  {
    name: 'taskmesh-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tool registry structure
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: any) => Promise<any>;
}

const registry: Map<string, ToolDefinition> = new Map();

// Helper to register tools matching the server.tool() signature
const toolRegistryWrapper = {
  tool: (
    name: string,
    description: string,
    properties: Record<string, any>,
    handler: (args: any) => Promise<any>
  ) => {
    const required: string[] = [];
    const schemaProperties: Record<string, any> = {};

    for (const [key, prop] of Object.entries(properties)) {
      schemaProperties[key] = {
        type: prop.type,
        description: prop.description,
        ...(prop.type === 'array' && prop.items ? { items: prop.items } : {}),
      };
      if (prop.required !== false) {
        required.push(key);
      }
    }

    registry.set(name, {
      name,
      description,
      inputSchema: {
        type: 'object',
        properties: schemaProperties,
        ...(required.length > 0 ? { required } : {}),
      },
      handler,
    });
  },
};

// Register all tools
registerAllTools(toolRegistryWrapper, api, resolver);

// Register MCP handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = Array.from(registry.values()).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));

  logger.info({ count: tools.length }, 'ListToolsRequest received');
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info({ name, args }, 'CallToolRequest received');

  const tool = registry.get(name);
  if (!tool) {
    logger.error({ name }, 'Requested tool not found');
    throw new Error(`Tool "${name}" not found`);
  }

  try {
    // Assert rate limit before tool execution
    limiter.assertLimit(name);

    // Run the tool handler
    const result = await tool.handler(args || {});
    return result;
  } catch (err: any) {
    logger.error({ name, error: err.message }, 'Tool execution failed');
    return {
      isError: true,
      content: [{ type: 'text', text: err.message }],
    };
  }
});

// Start the server using Stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('TaskMesh MCP Server started on Stdio transport');
}

main().catch((err) => {
  logger.fatal({ error: err.message }, 'Failed to start TaskMesh MCP Server');
  process.exit(1);
});
