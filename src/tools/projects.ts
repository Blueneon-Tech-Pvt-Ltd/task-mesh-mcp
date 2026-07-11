import { ApiClient } from '../client/api-client.js';

export function registerProjectTools(server: any, api: ApiClient) {
  // 1. List Projects
  server.tool(
    'list_projects',
    'List all projects in the organization',
    {},
    async () => {
      try {
        const projects = await api.get<any[]>('/pms/projects');
        return {
          content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 2. Get Project
  server.tool(
    'get_project',
    'Get detailed information of a specific project by ID',
    {
      id: { type: 'string', description: 'The project UUID' },
    },
    async ({ id }: { id: string }) => {
      try {
        const project = await api.get<any>(`/pms/projects/${id}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
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
    'Create a new project',
    {
      name: { type: 'string', description: 'Name of the project' },
      key: { type: 'string', description: 'Project key/code (e.g. PROJ)' },
      description: { type: 'string', description: 'Project description', required: false },
      leadId: { type: 'string', description: 'User UUID of the project lead' },
      folderId: { type: 'string', description: 'Optional project folder UUID', required: false },
      deptId: { type: 'string', description: 'Optional department UUID', required: false },
      startDate: { type: 'string', description: 'Optional ISO start date', required: false },
      targetDate: { type: 'string', description: 'Optional ISO target/due date', required: false },
    },
    async (params: any) => {
      try {
        const project = await api.post<any>('/pms/projects', params);
        return {
          content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
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
    'Update an existing project metadata or status',
    {
      id: { type: 'string', description: 'Project UUID to update' },
      name: { type: 'string', description: 'Name of the project', required: false },
      description: { type: 'string', description: 'Project description', required: false },
      leadId: { type: 'string', description: 'User UUID of the project lead', required: false },
      status: {
        type: 'string',
        description: 'Status (PLANNING, ACTIVE, PAUSED, COMPLETED, CANCELLED)',
        required: false,
      },
      startDate: { type: 'string', description: 'ISO start date', required: false },
      targetDate: { type: 'string', description: 'ISO target date', required: false },
    },
    async ({ id, ...data }: { id: string; [key: string]: any }) => {
      try {
        const project = await api.put<any>(`/pms/projects/${id}`, data);
        return {
          content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 5. Delete Project
  server.tool(
    'delete_project',
    'Delete a project',
    {
      id: { type: 'string', description: 'Project UUID to delete' },
    },
    async ({ id }: { id: string }) => {
      try {
        await api.delete<void>(`/pms/projects/${id}`);
        return {
          content: [{ type: 'text', text: `Project ${id} successfully deleted.` }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 6. Add Workflow Status
  server.tool(
    'add_workflow_status',
    'Add a new workflow status to a project',
    {
      projectId: { type: 'string', description: 'Project UUID' },
      name: { type: 'string', description: 'Name of the status (e.g. "QA Review")' },
      color: { type: 'string', description: 'Hex code or color name', required: false },
      category: { type: 'string', description: 'Category (TODO, IN_PROGRESS, DONE, BACKLOG)', required: false },
      startTimerTriggers: { type: 'boolean', description: 'Start timer when entering this status', required: false },
      stopTimerTriggers: { type: 'boolean', description: 'Stop timer when entering this status', required: false },
    },
    async ({ projectId, ...dto }: { projectId: string; [key: string]: any }) => {
      try {
        const status = await api.post<any>(`/pms/projects/${projectId}/statuses`, dto);
        return {
          content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
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
