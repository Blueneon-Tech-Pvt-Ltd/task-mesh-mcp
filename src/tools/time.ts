import { ApiClient } from '../client/api-client.js';
import { EntityResolver } from '../client/resolver.js';
import { formatIssueKey } from '../client/formatter.js';

export function registerTimeTools(server: any, api: ApiClient, resolver: EntityResolver) {
  // 1. Get Active Timer
  server.tool(
    'get_active_timer',
    'Get currently running stopwatch timer for the authenticated user',
    {},
    async () => {
      try {
        const timer = await api.get<any>('/time/timers/current');
        if (!timer || !timer.startedAt) {
          return {
            content: [{ type: 'text', text: '⏱️ No active timer currently running.' }],
          };
        }

        const key = timer.issue ? formatIssueKey(timer.issue) : 'General';
        const title = timer.issue?.title || '';
        const elapsedMinutes = Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 60000);

        return {
          content: [{
            type: 'text',
            text: `⏱️ **Active Timer Running**\n- **Task**: **${key}** ${title ? `(${title})` : ''}\n- **Started**: ${new Date(timer.startedAt).toLocaleTimeString()}\n- **Elapsed**: ${elapsedMinutes} minute(s)`,
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

  // 2. Start Timer (Accepts issue key e.g. ALPHA-14 or UUID)
  server.tool(
    'start_timer',
    'Start a running stopwatch timer on a specific issue using its key (e.g. "ALPHA-14") or UUID',
    {
      identifier: { type: 'string', description: 'Issue Key (e.g. "ALPHA-14") or UUID' },
    },
    async ({ identifier, issueId }: { identifier?: string; issueId?: string }) => {
      try {
        const target = identifier || issueId;
        if (!target) throw new Error('Issue identifier is required');

        // Fetch issue to get id if key was given
        const issue = await api.get<any>(`/pms/issues/${target}`);
        const timer = await api.post<any>('/time/timers/start', { issueId: issue.id });

        return {
          content: [{
            type: 'text',
            text: `⏱️ **Started live timer on ${formatIssueKey(issue)}**: "${issue.title}"`,
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

  // 3. Stop Timer
  server.tool(
    'stop_timer',
    'Stop the currently running stopwatch timer and log elapsed time',
    {},
    async () => {
      try {
        const result = await api.post<any>('/time/timers/stop', {});
        return {
          content: [{
            type: 'text',
            text: `⏹️ **Timer stopped.** ${result.message || 'Worklog recorded.'}`,
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

  // 4. Log Time Manually
  server.tool(
    'log_time',
    'Log time spent on an issue manually using its key (e.g. "ALPHA-14")',
    {
      identifier: { type: 'string', description: 'Issue Key (e.g. "ALPHA-14") or Issue UUID' },
      hours: { type: 'number', description: 'Number of hours spent (e.g. 1.5)' },
      description: { type: 'string', description: 'Worklog description of what was accomplished', required: false },
      date: { type: 'string', description: 'ISO date string (YYYY-MM-DD), defaults to today', required: false },
      billable: { type: 'boolean', description: 'Is the work billable? (default: true)', required: false },
    },
    async ({ identifier, issueId, hours, description, date, billable = true }: any) => {
      try {
        const target = identifier || issueId;
        if (!target) throw new Error('Issue identifier is required');

        const issue = await api.get<any>(`/pms/issues/${target}`);
        const logDate = date || new Date().toISOString().split('T')[0];

        const entry = await api.post<any>('/time/entries', {
          projectId: issue.projectId,
          issueId: issue.id,
          hours,
          description: description || null,
          date: logDate,
          billable,
        });

        return {
          content: [{
            type: 'text',
            text: `⏱️ **Logged ${hours}h on ${formatIssueKey(issue)}**\n- Date: ${logDate}\n- Description: ${description || 'None'}\n- Entry ID: \`${entry.id}\``,
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

  // 5. List Time Entries
  server.tool(
    'list_time_entries',
    'List logged time entries with optional filters',
    {
      projectId: { type: 'string', description: 'Filter by project key or UUID', required: false },
      identifier: { type: 'string', description: 'Filter by issue key (e.g. ALPHA-14) or UUID', required: false },
      startDate: { type: 'string', description: 'Filter start ISO date (YYYY-MM-DD)', required: false },
      endDate: { type: 'string', description: 'Filter end ISO date (YYYY-MM-DD)', required: false },
    },
    async ({ projectId, identifier, issueId, startDate, endDate }: any) => {
      try {
        const params: any = {};
        if (projectId) params.projectId = await resolver.resolveProjectId(projectId);
        if (identifier || issueId) {
          const issue = await api.get<any>(`/pms/issues/${identifier || issueId}`);
          params.issueId = issue.id;
        }
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const entries = await api.get<any[]>('/time/entries', params);
        if (!entries || entries.length === 0) {
          return { content: [{ type: 'text', text: '*No time entries found.*' }] };
        }

        const rows = entries.map((e: any) => {
          const issueKey = e.issue ? formatIssueKey(e.issue) : '-';
          const user = e.user?.name || 'User';
          const hours = `${e.hours}h`;
          const date = e.date ? new Date(e.date).toISOString().split('T')[0] : '-';
          const desc = e.description || '';
          return `| ${date} | ${issueKey} | ${user} | ${hours} | ${desc} |`;
        }).join('\n');

        const table = `| Date | Issue | User | Hours | Notes |\n| :--- | :--- | :--- | :--- | :--- |\n${rows}`;

        return {
          content: [{ type: 'text', text: `### Time Entries (${entries.length})\n${table}` }],
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
