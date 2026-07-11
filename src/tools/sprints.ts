import { ApiClient } from '../client/api-client.js';

export function registerSprintTools(server: any, api: ApiClient) {
  // 1. List Sprints
  server.tool(
    'list_sprints',
    'List all sprints for a project',
    {
      projectId: { type: 'string', description: 'Project UUID' },
    },
    async ({ projectId }: { projectId: string }) => {
      try {
        const sprints = await api.get<any[]>(`/pms/sprints/project/${projectId}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(sprints, null, 2) }],
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
        return {
          content: [{ type: 'text', text: JSON.stringify(sprint, null, 2) }],
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
    'Create a new sprint',
    {
      projectId: { type: 'string', description: 'Project UUID' },
      name: { type: 'string', description: 'Name of the sprint (e.g. "Sprint 1")' },
      goal: { type: 'string', description: 'Optional sprint goal', required: false },
      startDate: { type: 'string', description: 'Optional ISO start date', required: false },
      endDate: { type: 'string', description: 'Optional ISO end date', required: false },
    },
    async (params: any) => {
      try {
        const sprint = await api.post<any>('/pms/sprints', params);
        return {
          content: [{ type: 'text', text: JSON.stringify(sprint, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 4. Update Sprint
  server.tool(
    'update_sprint',
    'Update sprint details',
    {
      id: { type: 'string', description: 'Sprint UUID to update' },
      name: { type: 'string', description: 'Sprint name', required: false },
      goal: { type: 'string', description: 'Sprint goal', required: false },
      startDate: { type: 'string', description: 'ISO start date', required: false },
      endDate: { type: 'string', description: 'ISO end date', required: false },
      status: { type: 'string', description: 'Status (PLANNED, ACTIVE, COMPLETED)', required: false },
    },
    async ({ id, ...data }: { id: string; [key: string]: any }) => {
      try {
        const sprint = await api.put<any>(`/pms/sprints/${id}`, data);
        return {
          content: [{ type: 'text', text: JSON.stringify(sprint, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 5. Start Sprint
  server.tool(
    'start_sprint',
    'Start a planned sprint',
    {
      id: { type: 'string', description: 'Sprint UUID' },
    },
    async ({ id }: { id: string }) => {
      try {
        const sprint = await api.post<any>(`/pms/sprints/${id}/start`);
        return {
          content: [{ type: 'text', text: JSON.stringify(sprint, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 6. Complete Sprint
  server.tool(
    'complete_sprint',
    'Complete an active sprint and optionally roll over incomplete issues',
    {
      id: { type: 'string', description: 'Sprint UUID' },
      rolloverSprintId: { type: 'string', description: 'Optional sprint UUID to roll over incomplete issues to', required: false },
    },
    async ({ id, rolloverSprintId }: { id: string; rolloverSprintId?: string }) => {
      try {
        const result = await api.post<any>(`/pms/sprints/${id}/complete`, { rolloverSprintId });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 7. Delete Sprint
  server.tool(
    'delete_sprint',
    'Delete a sprint',
    {
      id: { type: 'string', description: 'Sprint UUID' },
    },
    async ({ id }: { id: string }) => {
      try {
        await api.delete<void>(`/pms/sprints/${id}`);
        return {
          content: [{ type: 'text', text: `Sprint ${id} successfully deleted.` }],
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
