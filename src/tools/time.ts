import { ApiClient } from '../client/api-client.js';

export function registerTimeTools(server: any, api: ApiClient) {
  // 1. Log Time (Manual Entry)
  server.tool(
    'log_time',
    'Log time spent on an issue manually',
    {
      projectId: { type: 'string', description: 'Project UUID' },
      issueId: { type: 'string', description: 'Optional Issue UUID', required: false },
      description: { type: 'string', description: 'Worklog description', required: false },
      hours: { type: 'number', description: 'Number of hours spent' },
      date: { type: 'string', description: 'ISO date string representing the work day' },
      billable: { type: 'boolean', description: 'Is the work billable?', required: false },
    },
    async (params: any) => {
      try {
        const entry = await api.post<any>('/time/entries', params);
        return {
          content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 2. List Time Entries
  server.tool(
    'list_time_entries',
    'List logged time entries with filters',
    {
      userId: { type: 'string', description: 'Filter by user UUID', required: false },
      projectId: { type: 'string', description: 'Filter by project UUID', required: false },
      issueId: { type: 'string', description: 'Filter by issue UUID', required: false },
      startDate: { type: 'string', description: 'Filter start ISO date', required: false },
      endDate: { type: 'string', description: 'Filter end ISO date', required: false },
    },
    async (params: any) => {
      try {
        const entries = await api.get<any[]>('/time/entries', params);
        return {
          content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 3. Get Active Timer
  server.tool(
    'get_active_timer',
    'Get currently running timer for the authenticated user',
    {},
    async () => {
      try {
        const timer = await api.get<any>('/time/timers/current');
        return {
          content: [{ type: 'text', text: JSON.stringify(timer, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 4. Start Timer
  server.tool(
    'start_timer',
    'Start a running stopwatch timer on a specific issue',
    {
      issueId: { type: 'string', description: 'Issue UUID' },
    },
    async ({ issueId }: { issueId: string }) => {
      try {
        const timer = await api.post<any>('/time/timers/start', { issueId });
        return {
          content: [{ type: 'text', text: JSON.stringify(timer, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 5. Stop Timer
  server.tool(
    'stop_timer',
    'Stop the active running timer and save it as a time entry',
    {},
    async () => {
      try {
        const entry = await api.post<any>('/time/timers/stop');
        return {
          content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }],
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
