import { ApiClient } from '../client/api-client.js';
import { EntityResolver } from '../client/resolver.js';
import { formatProjectsList } from '../client/formatter.js';

export function registerProjectTools(server: any, api: ApiClient, resolver: EntityResolver) {
  // 1. List Projects (Token-optimized)
  server.tool(
    'list_projects',
    'List all projects in the organization with keys, leads, and available workflow statuses',
    {
      json: { type: 'boolean', description: 'Set true to return raw JSON instead of overview table', required: false },
    },
    async ({ json }: { json?: boolean } = {}) => {
      try {
        const projects = await api.get<any[]>('/pms/projects');
        if (json) {
          return {
            content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
          };
        }

        return {
          content: [{ type: 'text', text: formatProjectsList(projects) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 2. Get Project by Key (e.g. ALPHA) or UUID
  server.tool(
    'get_project',
    'Get detailed information of a project using its key (e.g. "ALPHA") or UUID',
    {
      identifier: { type: 'string', description: 'Project key (e.g. "ALPHA") or UUID' },
      json: { type: 'boolean', description: 'Set true to return raw JSON', required: false },
    },
    async ({ identifier, id, json }: { identifier?: string; id?: string; json?: boolean }) => {
      try {
        const target = identifier || id;
        if (!target) throw new Error('Project identifier is required');

        const resolvedId = await resolver.resolveProjectId(target);
        const project = await api.get<any>(`/pms/projects/${resolvedId}`);

        if (json) {
          return {
            content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
          };
        }

        const statuses = (project.workflowStatuses || [])
          .map((s: any) => `- **${s.name}** (Category: \`${s.category}\`, ID: \`${s.id}\`)`)
          .join('\n');

        const members = (project.members || [])
          .map((m: any) => `- ${m.user?.name || m.user?.email || 'Member'} (${m.role})`)
          .join('\n');

        const output = `## Project: ${project.name} (${project.key})
- **Lead**: ${project.lead?.name || 'Unassigned'} (${project.lead?.email || ''})
- **Description**: ${project.description || '_None_'}
- **Dates**: ${project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : 'N/A'} ➔ ${project.targetDate ? new Date(project.targetDate).toISOString().split('T')[0] : 'N/A'}

### Workflow Statuses
${statuses || '_No statuses configured._'}

### Team Members (${project.members?.length || 0})
${members || '_No members._'}`;

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 3. Create Project
  server.tool(
    'create_project',
    'Create a new project workspace',
    {
      name: { type: 'string', description: 'Name of the project' },
      key: { type: 'string', description: 'Project key/code prefix (e.g. "PROJ", "ALPHA")' },
      description: { type: 'string', description: 'Project description', required: false },
      leadId: { type: 'string', description: 'User UUID of the project lead', required: false },
      startDate: { type: 'string', description: 'Optional ISO start date (YYYY-MM-DD)', required: false },
      targetDate: { type: 'string', description: 'Optional ISO target date (YYYY-MM-DD)', required: false },
    },
    async (params: any) => {
      try {
        const project = await api.post<any>('/pms/projects', params);
        return {
          content: [{
            type: 'text',
            text: `✅ **Created Project ${project.name} (${project.key})**\nID: \`${project.id}\``,
          }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 4. Update Project
  server.tool(
    'update_project',
    'Update an existing project metadata or status using key or UUID',
    {
      identifier: { type: 'string', description: 'Project key (e.g. "ALPHA") or UUID' },
      name: { type: 'string', description: 'Name of the project', required: false },
      description: { type: 'string', description: 'Project description', required: false },
      status: {
        type: 'string',
        description: 'Status (PLANNING, ACTIVE, PAUSED, COMPLETED, CANCELLED)',
        required: false,
      },
      startDate: { type: 'string', description: 'ISO start date', required: false },
      targetDate: { type: 'string', description: 'ISO target date', required: false },
    },
    async ({ identifier, id, ...data }: { identifier?: string; id?: string; [key: string]: any }) => {
      try {
        const target = identifier || id;
        if (!target) throw new Error('Project identifier is required');

        const resolvedId = await resolver.resolveProjectId(target);
        const project = await api.put<any>(`/pms/projects/${resolvedId}`, data);
        return {
          content: [{
            type: 'text',
            text: `✅ **Updated Project ${project.name} (${project.key})**`,
          }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );
}
