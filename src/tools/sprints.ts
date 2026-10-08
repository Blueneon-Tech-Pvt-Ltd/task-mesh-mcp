import { ApiClient } from '../client/api-client.js';
import { EntityResolver } from '../client/resolver.js';

export function registerSprintTools(server: any, api: ApiClient, resolver: EntityResolver) {
  // 1. List Sprints
  server.tool(
    'list_sprints',
    'List all sprints for a project using its key (e.g. "ALPHA") or UUID',
    {
      projectId: { type: 'string', description: 'Project key (e.g. "ALPHA") or UUID' },
      json: { type: 'boolean', description: 'Set true to return raw JSON', required: false },
    },
    async ({ projectId, json }: { projectId: string; json?: boolean }) => {
      try {
        const resolvedId = await resolver.resolveProjectId(projectId);
        const sprints = await api.get<any[]>(`/pms/sprints/project/${resolvedId}`);

        if (json) {
          return {
            content: [{ type: 'text', text: JSON.stringify(sprints, null, 2) }],
          };
        }

        if (!sprints || sprints.length === 0) {
          return { content: [{ type: 'text', text: '*No sprints found for this project.*' }] };
        }

        const rows = sprints.map((s: any) => {
          const status = s.status || 'PLANNED';
          const dates = `${s.startDate ? new Date(s.startDate).toLocaleDateString() : 'N/A'} - ${s.endDate ? new Date(s.endDate).toLocaleDateString() : 'N/A'}`;
          const goal = s.goal || '-';
          return `| **${s.name}** | \`${status}\` | ${dates} | ${goal} | \`${s.id}\` |`;
        }).join('\n');

        const table = `| Sprint | Status | Duration | Goal | Sprint ID |\n| :--- | :--- | :--- | :--- | :--- |\n${rows}`;

        return {
          content: [{ type: 'text', text: `### Sprints for Project\n${table}` }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 2. Get Sprint
  server.tool(
    'get_sprint',
    'Get detailed information of a specific sprint by ID',
    {
      id: { type: 'string', description: 'Sprint UUID' },
    },
    async ({ id }: { id: string }) => {
      try {
        const sprint = await api.get<any>(`/pms/sprints/${id}`);
        const issues = (sprint.issues || []).map((si: any) => {
          const issue = si.issue || si;
          return `- **${issue.title}** (${issue.status?.name || 'Status: ' + issue.statusId}, Est: ${issue.estimate ?? '-'} pts)`;
        }).join('\n');

        const output = `## Sprint: ${sprint.name} (${sprint.status})
- **Goal**: ${sprint.goal || '_No goal set._'}
- **Dates**: ${sprint.startDate ? new Date(sprint.startDate).toLocaleDateString() : 'N/A'} ➔ ${sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : 'N/A'}
- **Total Issues**: ${sprint.issues?.length || 0}

### Sprint Backlog
${issues || '_No issues assigned to this sprint._'}`;

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

  // 3. Create Sprint
  server.tool(
    'create_sprint',
    'Create a new sprint in a project',
    {
      projectId: { type: 'string', description: 'Project key (e.g. "ALPHA") or UUID' },
      name: { type: 'string', description: 'Name of the sprint (e.g. "Sprint 1")' },
      goal: { type: 'string', description: 'Optional sprint goal', required: false },
      startDate: { type: 'string', description: 'Optional ISO start date (YYYY-MM-DD)', required: false },
      endDate: { type: 'string', description: 'Optional ISO end date (YYYY-MM-DD)', required: false },
    },
    async (params: any) => {
      try {
        const resolvedProjectId = await resolver.resolveProjectId(params.projectId);
        const sprint = await api.post<any>('/pms/sprints', {
          ...params,
          projectId: resolvedProjectId,
        });
        return {
          content: [{
            type: 'text',
            text: `✅ **Created Sprint "${sprint.name}"** (ID: \`${sprint.id}\`)`,
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

  // 4. Start Sprint
  server.tool(
    'start_sprint',
    'Start a planned sprint to make it ACTIVE',
    {
      id: { type: 'string', description: 'Sprint UUID' },
    },
    async ({ id }: { id: string }) => {
      try {
        const sprint = await api.post<any>(`/pms/sprints/${id}/start`, {});
        return {
          content: [{ type: 'text', text: `🚀 **Sprint "${sprint.name}" is now ACTIVE!**` }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 5. Complete Sprint
  server.tool(
    'complete_sprint',
    'Complete an active sprint',
    {
      id: { type: 'string', description: 'Sprint UUID' },
    },
    async ({ id }: { id: string }) => {
      try {
        const sprint = await api.post<any>(`/pms/sprints/${id}/complete`, {});
        return {
          content: [{ type: 'text', text: `🏁 **Sprint "${sprint.name}" marked as COMPLETED.**` }],
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
