import { ApiClient } from '../client/api-client.js';
import { EntityResolver } from '../client/resolver.js';
import { registerContextTools } from './context.js';
import { registerProjectTools } from './projects.js';
import { registerIssueTools } from './issues.js';
import { registerSprintTools } from './sprints.js';
import { registerTimeTools } from './time.js';

export function registerAllTools(server: any, api: ApiClient, resolver: EntityResolver) {
  registerContextTools(server, api, resolver);
  registerProjectTools(server, api, resolver);
  registerIssueTools(server, api, resolver);
  registerSprintTools(server, api, resolver);
  registerTimeTools(server, api, resolver);
}
