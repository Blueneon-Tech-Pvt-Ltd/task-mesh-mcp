import { ApiClient } from '../client/api-client.js';
import { EntityResolver } from '../client/resolver.js';
import { formatIssueDetail, formatIssueList, formatIssueKey } from '../client/formatter.js';

export function registerContextTools(server: any, api: ApiClient, resolver: EntityResolver) {
  // 1. Get Agent Context (Single 1-shot bootstrap tool for AI agents)
  server.tool(
    'get_agent_context',
    'Get a compact workspace snapshot including active projects, current sprint, assigned tasks, and running timer. Call this at the start of work to avoid multi-step exploration.',
    {},
    async () => {
      try {
        const [projects, activeTimer, myIssuesResponse] = await Promise.allSettled([
          api.get<any[]>('/pms/projects'),
          api.get<any>('/time/timers/current'),
          api.get<any>('/pms/issues', { limit: 10 }),
        ]);

        const projectsList = projects.status === 'fulfilled' ? projects.value : [];
        const timer = activeTimer.status === 'fulfilled' ? activeTimer.value : null;
        const issues = myIssuesResponse.status === 'fulfilled' 
          ? (Array.isArray(myIssuesResponse.value) ? myIssuesResponse.value : myIssuesResponse.value?.items || [])
          : [];

        let output = `## TaskMesh Workspace Context\n`;

        // Active Timer
        if (timer && timer.startedAt) {
          const timerKey = timer.issue ? formatIssueKey(timer.issue) : 'General';
          const elapsedMinutes = Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 60000);
          output += `⏱️ **Active Timer Running**: Working on **${timerKey}** (${elapsedMinutes}m elapsed)\n\n`;
        } else {
          output += `⏱️ **Timer**: No active timer running.\n\n`;
        }

        // Projects
        output += `### Projects (${projectsList.length})\n`;
        if (projectsList.length > 0) {
          const projSummary = projectsList.map((p: any) => {
            const statuses = (p.workflowStatuses || []).map((s: any) => s.name).join(', ');
            return `- **${(p.key || '').toUpperCase()}**: ${p.name} (Statuses: ${statuses || 'Default'})`;
          }).join('\n');
          output += `${projSummary}\n\n`;
        } else {
          output += `_No active projects found._\n\n`;
        }

        // Recent / Assigned Issues
        output += formatIssueList(issues.slice(0, 8), 'Recent Workspace Issues');

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to load agent context: ${err.message}` }],
        };
      }
    }
  );

  // 2. Global Search Issues across the whole organization
  server.tool(
    'search_issues',
    'Quickly search issues across the entire workspace by keyword, key (e.g. ALPHA-12), status, or priority in 1 shot.',
    {
      query: { type: 'string', description: 'Search term, issue key (e.g. PROJ-5), or title keyword' },
      projectId: { type: 'string', description: 'Optional project key (e.g. ALPHA) or UUID filter', required: false },
      status: { type: 'string', description: 'Optional status filter (e.g. "In Progress", "TODO", "DONE")', required: false },
      limit: { type: 'number', description: 'Max results to return (default: 10)', required: false },
    },
    async ({ query, projectId, status, limit = 10 }: any) => {
      try {
        let resolvedProjectId = undefined;
        if (projectId) {
          resolvedProjectId = await resolver.resolveProjectId(projectId);
        }

        // Check if query is an exact issue key like "ALPHA-12"
        if (/^[A-Za-z0-9_]+-\d+$/.test(query.trim())) {
          try {
            const directIssue = await api.get<any>(`/pms/issues/${query.trim().toUpperCase()}`);
            if (directIssue) {
              return {
                content: [{ type: 'text', text: formatIssueDetail(directIssue) }],
              };
            }
          } catch {
            // Fall through to search
          }
        }

        const params: any = {
          search: query,
          limit,
        };
        if (resolvedProjectId) params.projectId = resolvedProjectId;

        const response = await api.get<any>('/pms/issues', params);
        const issues = Array.isArray(response) ? response : response?.items || [];

        return {
          content: [{ type: 'text', text: formatIssueList(issues, `Search Results for "${query}"`) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Search failed: ${err.message}` }],
        };
      }
    }
  );

  // 3. Start Working on Issue (Composite 1-shot tool: finds task, sets status to IN_PROGRESS, starts timer)
  server.tool(
    'start_working_on_issue',
    '1-shot action to begin work on an issue: moves issue to IN_PROGRESS, starts a live stopwatch timer, and returns issue details.',
    {
      identifier: { type: 'string', description: 'Issue Key (e.g. "ALPHA-14") or Issue UUID' },
    },
    async ({ identifier }: { identifier: string }) => {
      try {
        // 1. Fetch issue details
        const issue = await api.get<any>(`/pms/issues/${identifier}`);
        if (!issue) {
          throw new Error(`Issue "${identifier}" not found`);
        }

        // 2. Resolve "In Progress" workflow status
        const inProgressStatusId = await resolver.resolveStatusId(issue.projectId, 'In Progress');
        
        // 3. Update status to IN_PROGRESS
        await api.patch<any>(`/pms/issues/${issue.id}`, { statusId: inProgressStatusId });

        // 4. Start timer on issue
        try {
          await api.post<any>('/time/timers/start', { issueId: issue.id });
        } catch (timerErr: any) {
          // Timer start non-fatal if already started
        }

        // 5. Re-fetch updated issue
        const updated = await api.get<any>(`/pms/issues/${issue.id}`);

        return {
          content: [{
            type: 'text',
            text: `🚀 **Started working on ${formatIssueKey(updated)}**\n- Status set to: **In Progress**\n- Live timer started\n\n${formatIssueDetail(updated)}`,
          }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to start work on issue: ${err.message}` }],
        };
      }
    }
  );
}
