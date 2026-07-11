import { ApiClient } from '../client/api-client.js';
import { registerProjectTools } from './projects.js';
import { registerIssueTools } from './issues.js';
import { registerSprintTools } from './sprints.js';
import { registerTimeTools } from './time.js';

export function registerAllTools(server: any, api: ApiClient) {
  registerProjectTools(server, api);
  registerIssueTools(server, api);
  registerSprintTools(server, api);
  registerTimeTools(server, api);
}
