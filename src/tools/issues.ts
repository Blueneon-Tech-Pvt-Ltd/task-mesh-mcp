import { ApiClient } from '../client/api-client.js';

export function registerIssueTools(server: any, api: ApiClient) {
  // 1. List Issues
  server.tool(
    'list_issues',
    'List issues with optional filters',
    {
      projectId: { type: 'string', description: 'Project UUID' },
      assigneeId: { type: 'string', description: 'Filter by assignee UUID', required: false },
      statusId: { type: 'string', description: 'Filter by workflow status UUID', required: false },
      type: { type: 'string', description: 'Filter by type (BUG, TASK, STORY, EPIC)', required: false },
      priority: { type: 'string', description: 'Filter by priority (NO_PRIORITY, LOW, MEDIUM, HIGH, URGENT)', required: false },
      sprintId: { type: 'string', description: 'Filter by sprint UUID', required: false },
      search: { type: 'string', description: 'Search text in title or description', required: false },
    },
    async (params: any) => {
      try {
        const issues = await api.get<any[]>('/pms/issues', params);
        return {
          content: [{ type: 'text', text: JSON.stringify(issues, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 2. Get Issue
  server.tool(
    'get_issue',
    'Get detailed information of a specific issue by ID',
    {
      id: { type: 'string', description: 'Issue UUID' },
    },
    async ({ id }: { id: string }) => {
      try {
        const issue = await api.get<any>(`/pms/issues/${id}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(issue, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 3. Create Issue
  server.tool(
    'create_issue',
    'Create a new issue inside a project',
    {
      projectId: { type: 'string', description: 'Project UUID' },
      title: { type: 'string', description: 'Issue title' },
      description: { type: 'string', description: 'Issue description text', required: false },
      type: { type: 'string', description: 'Type (BUG, TASK, STORY, EPIC)', required: false },
      statusId: { type: 'string', description: 'Workflow status UUID', required: false },
      priority: { type: 'string', description: 'Priority (NO_PRIORITY, LOW, MEDIUM, HIGH, URGENT)', required: false },
      estimate: { type: 'number', description: 'Story points estimate', required: false },
      dueDate: { type: 'string', description: 'ISO date string', required: false },
    },
    async (params: any) => {
      try {
        // If description is provided as plain text, package it as rich text structure if needed,
        // or let NestJS parser handle string/JSON. Looking at prisma schema, description is Json?.
        // We'll pass it as string, if the backend expects JSON block (like Slate/Lexical format)
        // we check if it is valid json string, otherwise wrap it.
        const body = { ...params };
        if (params.description) {
          try {
            body.description = JSON.parse(params.description);
          } catch {
            // Default block node format if the app uses lexical/editorJS, or just string if it accepts string
            body.description = { type: 'doc', content: [{ type: 'paragraph', children: [{ text: params.description }] }] };
          }
        }

        const issue = await api.post<any>('/pms/issues', body);
        return {
          content: [{ type: 'text', text: JSON.stringify(issue, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 4. Update Issue
  server.tool(
    'update_issue',
    'Update an existing issue status, assignee, estimate, or metadata',
    {
      id: { type: 'string', description: 'Issue UUID to update' },
      title: { type: 'string', description: 'New title', required: false },
      description: { type: 'string', description: 'New description text', required: false },
      statusId: { type: 'string', description: 'New status UUID', required: false },
      priority: { type: 'string', description: 'New priority', required: false },
      estimate: { type: 'number', description: 'New estimate points', required: false },
      dueDate: { type: 'string', description: 'New ISO due date', required: false },
      sprintId: { type: 'string', description: 'Assign to sprint UUID', required: false },
      assigneeIds: { type: 'array', items: { type: 'string' }, description: 'Array of assignee user UUIDs', required: false },
    },
    async ({ id, ...params }: { id: string; [key: string]: any }) => {
      try {
        const body = { ...params };
        if (params.description) {
          try {
            body.description = JSON.parse(params.description);
          } catch {
            body.description = { type: 'doc', content: [{ type: 'paragraph', children: [{ text: params.description }] }] };
          }
        }

        const issue = await api.patch<any>(`/pms/issues/${id}`, body);
        return {
          content: [{ type: 'text', text: JSON.stringify(issue, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 5. Delete Issue
  server.tool(
    'delete_issue',
    'Delete an issue',
    {
      id: { type: 'string', description: 'Issue UUID to delete' },
    },
    async ({ id }: { id: string }) => {
      try {
        await api.delete<void>(`/pms/issues/${id}`);
        return {
          content: [{ type: 'text', text: `Issue ${id} successfully deleted.` }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 6. Add Comment
  server.tool(
    'add_comment',
    'Add a discussion comment to an issue',
    {
      issueId: { type: 'string', description: 'Issue UUID' },
      body: { type: 'string', description: 'Comment body text' },
    },
    async ({ issueId, body }: { issueId: string; body: string }) => {
      try {
        // Wrap plain text comment body as editor JSON doc if needed
        const commentDoc = {
          type: 'doc',
          content: [{ type: 'paragraph', children: [{ text: body }] }],
        };
        const comment = await api.post<any>(`/pms/issues/${issueId}/comments`, { body: commentDoc });
        return {
          content: [{ type: 'text', text: JSON.stringify(comment, null, 2) }],
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
