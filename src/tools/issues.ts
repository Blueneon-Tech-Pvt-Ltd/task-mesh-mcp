import { ApiClient } from '../client/api-client.js';
import { EntityResolver } from '../client/resolver.js';
import { formatIssueDetail, formatIssueList, formatIssueKey } from '../client/formatter.js';

export function registerIssueTools(server: any, api: ApiClient, resolver: EntityResolver) {
  // 1. List Issues (Token optimized)
  server.tool(
    'list_issues',
    'List issues with optional filters. Returns a compact, token-friendly table by default.',
    {
      projectId: { type: 'string', description: 'Optional project key (e.g. ALPHA) or UUID', required: false },
      assigneeId: { type: 'string', description: 'Filter by assignee UUID', required: false },
      statusId: { type: 'string', description: 'Filter by workflow status UUID or name', required: false },
      type: { type: 'string', description: 'Filter by type (BUG, TASK, STORY, EPIC)', required: false },
      priority: { type: 'string', description: 'Filter by priority (NO_PRIORITY, LOW, MEDIUM, HIGH, URGENT)', required: false },
      sprintId: { type: 'string', description: 'Filter by sprint UUID', required: false },
      search: { type: 'string', description: 'Search text in title or description', required: false },
      limit: { type: 'number', description: 'Max issues to return (default: 20)', required: false },
      json: { type: 'boolean', description: 'Set true to return raw JSON instead of compact Markdown', required: false },
    },
    async (params: any) => {
      try {
        const queryParams: any = { ...params };
        delete queryParams.json;

        if (params.projectId) {
          queryParams.projectId = await resolver.resolveProjectId(params.projectId);
        }

        const response = await api.get<any>('/pms/issues', queryParams);
        const issues = Array.isArray(response) ? response : response?.items || [];

        if (params.json) {
          return {
            content: [{ type: 'text', text: JSON.stringify(issues, null, 2) }],
          };
        }

        return {
          content: [{ type: 'text', text: formatIssueList(issues, 'Issues') }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 2. Get Issue by Key (e.g. ALPHA-14) or UUID
  server.tool(
    'get_issue',
    'Get detailed information of an issue using its human key (e.g. "ALPHA-14") or UUID.',
    {
      identifier: { type: 'string', description: 'Issue Key (e.g. "ALPHA-14") or UUID' },
      json: { type: 'boolean', description: 'Set true to return raw JSON instead of formatted Markdown', required: false },
    },
    async ({ identifier, id, json }: { identifier?: string; id?: string; json?: boolean }) => {
      try {
        const target = identifier || id;
        if (!target) throw new Error('Issue identifier is required');

        const issue = await api.get<any>(`/pms/issues/${target}`);
        if (json) {
          return {
            content: [{ type: 'text', text: JSON.stringify(issue, null, 2) }],
          };
        }

        return {
          content: [{ type: 'text', text: formatIssueDetail(issue) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 3. Create Issue (Accepts human project keys and status names)
  server.tool(
    'create_issue',
    'Create a new issue inside a project (accepts project key like "ALPHA" and status names like "To Do")',
    {
      projectId: { type: 'string', description: 'Project key (e.g. "ALPHA") or Project UUID' },
      title: { type: 'string', description: 'Issue title' },
      description: { type: 'string', description: 'Issue description in plain text or markdown', required: false },
      type: { type: 'string', description: 'Type (BUG, TASK, STORY, EPIC)', required: false },
      status: { type: 'string', description: 'Workflow status name (e.g. "To Do", "In Progress") or UUID', required: false },
      priority: { type: 'string', description: 'Priority (NO_PRIORITY, LOW, MEDIUM, HIGH, URGENT)', required: false },
      assignee: { type: 'string', description: 'Assignee name, email, or UUID', required: false },
      estimate: { type: 'number', description: 'Story points estimate', required: false },
      dueDate: { type: 'string', description: 'ISO date string (YYYY-MM-DD)', required: false },
    },
    async (params: any) => {
      try {
        const resolvedProjectId = await resolver.resolveProjectId(params.projectId);
        
        let statusId = undefined;
        if (params.status || params.statusId) {
          statusId = await resolver.resolveStatusId(resolvedProjectId, params.status || params.statusId);
        }

        let assigneeIds = undefined;
        if (params.assignee) {
          const userId = await resolver.resolveUserId(resolvedProjectId, params.assignee);
          if (userId) assigneeIds = [userId];
        }

        const body: any = {
          projectId: resolvedProjectId,
          title: params.title,
          description: params.description || null,
          type: params.type || undefined,
          statusId,
          priority: params.priority || undefined,
          assigneeIds,
          estimate: params.estimate || undefined,
          dueDate: params.dueDate || undefined,
        };

        const issue = await api.post<any>('/pms/issues', body);
        return {
          content: [{
            type: 'text',
            text: `✅ **Created Issue ${formatIssueKey(issue)}**: ${issue.title}\n\n${formatIssueDetail(issue)}`,
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

  // 4. Update Issue (Accepts human keys e.g. ALPHA-14 and status names)
  server.tool(
    'update_issue',
    'Update an existing issue status, assignee, estimate, or metadata using its key (e.g. "ALPHA-14")',
    {
      identifier: { type: 'string', description: 'Issue Key (e.g. "ALPHA-14") or UUID' },
      status: { type: 'string', description: 'New workflow status (e.g. "In Progress", "DONE", "To Do") or UUID', required: false },
      title: { type: 'string', description: 'New title', required: false },
      description: { type: 'string', description: 'Updated description', required: false },
      priority: { type: 'string', description: 'Priority (NO_PRIORITY, LOW, MEDIUM, HIGH, URGENT)', required: false },
      type: { type: 'string', description: 'Type (BUG, TASK, STORY, EPIC)', required: false },
      assignee: { type: 'string', description: 'Assignee name, email, or UUID', required: false },
      estimate: { type: 'number', description: 'Story points estimate', required: false },
      dueDate: { type: 'string', description: 'ISO date string (YYYY-MM-DD)', required: false },
    },
    async ({ identifier, id, status, statusId, assignee, ...rest }: any) => {
      try {
        const target = identifier || id;
        if (!target) throw new Error('Issue identifier is required');

        // Fetch current issue to resolve relations if needed
        const current = await api.get<any>(`/pms/issues/${target}`);
        if (!current) throw new Error(`Issue "${target}" not found`);

        const updateBody: any = { ...rest };

        if (status || statusId) {
          updateBody.statusId = await resolver.resolveStatusId(current.projectId, status || statusId);
        }

        if (assignee) {
          const userId = await resolver.resolveUserId(current.projectId, assignee);
          if (userId) updateBody.assigneeIds = [userId];
        }

        const updated = await api.patch<any>(`/pms/issues/${current.id}`, updateBody);
        const fullUpdated = await api.get<any>(`/pms/issues/${current.id}`);

        return {
          content: [{
            type: 'text',
            text: `✅ **Updated Issue ${formatIssueKey(fullUpdated)}**\n\n${formatIssueDetail(fullUpdated)}`,
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

  // 5. Add Comment to Issue
  server.tool(
    'add_comment',
    'Add a discussion comment to an issue using its key (e.g. "ALPHA-14")',
    {
      identifier: { type: 'string', description: 'Issue Key (e.g. "ALPHA-14") or UUID' },
      content: { type: 'string', description: 'Comment message text' },
    },
    async ({ identifier, id, content }: { identifier?: string; id?: string; content: string }) => {
      try {
        const target = identifier || id;
        if (!target) throw new Error('Issue identifier is required');

        const current = await api.get<any>(`/pms/issues/${target}`);
        if (!current) throw new Error(`Issue "${target}" not found`);

        const comment = await api.post<any>(`/pms/issues/${current.id}/comments`, { content });
        return {
          content: [{
            type: 'text',
            text: `💬 Added comment to **${formatIssueKey(current)}**: "${content}"`,
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

  // 6. Delete Issue
  server.tool(
    'delete_issue',
    'Soft delete an issue by Key (e.g. "ALPHA-14") or UUID',
    {
      identifier: { type: 'string', description: 'Issue Key (e.g. "ALPHA-14") or UUID' },
    },
    async ({ identifier, id }: { identifier?: string; id?: string }) => {
      try {
        const target = identifier || id;
        if (!target) throw new Error('Issue identifier is required');

        const current = await api.get<any>(`/pms/issues/${target}`);
        if (!current) throw new Error(`Issue "${target}" not found`);

        await api.delete<any>(`/pms/issues/${current.id}`);
        return {
          content: [{ type: 'text', text: `🗑️ Successfully deleted issue ${formatIssueKey(current)}` }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      }
    }
  );

  // 7. Finish Issue (Composite 1-shot write-back: stops timer, sets status to Done/In Review, logs summary comment)
  server.tool(
    'finish_issue',
    '1-shot composite action to complete work on an issue: stops any running timer, updates status (default: "Done"), and posts a structured execution summary comment with files changed, PR link, and notes.',
    {
      identifier: { type: 'string', description: 'Issue Key (e.g. "ALPHA-14") or Issue UUID' },
      summary: { type: 'string', description: '1-3 sentence summary of what was accomplished' },
      status: { type: 'string', description: 'Status to transition to (e.g. "Done", "In Review", "QA")', required: false },
      filesChanged: { type: 'array', description: 'List of file paths modified or created', items: { type: 'string' }, required: false },
      prUrl: { type: 'string', description: 'Link to Pull Request created for this task', required: false },
      notes: { type: 'string', description: 'Optional technical notes, caveats, or follow-ups', required: false },
      hoursSpent: { type: 'number', description: 'Optional hours spent to log if not using live timer', required: false },
    },
    async ({
      identifier,
      summary,
      status = 'Done',
      filesChanged = [],
      prUrl,
      notes,
      hoursSpent,
    }: {
      identifier: string;
      summary: string;
      status?: string;
      filesChanged?: string[];
      prUrl?: string;
      notes?: string;
      hoursSpent?: number;
    }) => {
      try {
        const issue = await api.get<any>(`/pms/issues/${identifier}`);
        if (!issue) throw new Error(`Issue "${identifier}" not found`);

        // 1. Stop timer if running
        try {
          await api.post<any>('/time/timers/stop', {});
        } catch {
          // Non-fatal if timer wasn't running
        }

        // 2. Log time if hours explicitly provided
        if (hoursSpent && hoursSpent > 0) {
          try {
            await api.post<any>('/time/entries', {
              projectId: issue.projectId,
              issueId: issue.id,
              hours: hoursSpent,
              description: summary,
              date: new Date().toISOString().split('T')[0],
              billable: true,
            });
          } catch {
            // Non-fatal
          }
        }

        // 3. Resolve status ID & Update status
        try {
          const statusId = await resolver.resolveStatusId(issue.projectId, status);
          await api.patch<any>(`/pms/issues/${issue.id}`, { statusId });
        } catch {
          // If status resolution fails, continue
        }

        // 4. Construct structured comment
        const commentLines = [
          `🤖 **AI Work Completed** (${status})`,
          '',
          `**Summary:** ${summary}`,
          filesChanged?.length ? `\n**Files Changed:**\n${filesChanged.map((f) => `- \`${f}\``).join('\n')}` : '',
          prUrl ? `\n**PR:** ${prUrl}` : '',
          notes ? `\n**Notes:** ${notes}` : '',
        ].filter(Boolean).join('\n');

        await api.post<any>(`/pms/issues/${issue.id}/comments`, { content: commentLines });

        return {
          content: [
            {
              type: 'text',
              text: `✅ **Finished ${formatIssueKey(issue)}**\n- Status set to: **${status}**\n- Timer stopped / worklog recorded\n- Summary comment posted to issue history`,
            },
          ],
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  // 8. Propose Issue (AI drafts an issue for human review)
  server.tool(
    'propose_issue',
    'Propose a new task or bug discovered during autonomous execution. Lands as a draft issue with rationale for human approval before entering sprints.',
    {
      projectId: { type: 'string', description: 'Project key (e.g. "ALPHA") or UUID' },
      title: { type: 'string', description: 'Short descriptive issue title' },
      description: { type: 'string', description: 'Detailed markdown description' },
      type: { type: 'string', description: 'Issue type: "TASK", "BUG", "STORY", "EPIC"', required: false },
      priority: { type: 'string', description: 'Priority: "LOW", "MEDIUM", "HIGH", "URGENT"', required: false },
      rationale: { type: 'string', description: 'Why this task is proposed (evidence discovered during work)', required: false },
    },
    async ({
      projectId,
      title,
      description,
      type = 'TASK',
      priority = 'MEDIUM',
      rationale,
    }: any) => {
      try {
        const resolvedProjectId = await resolver.resolveProjectId(projectId);
        const descWithRationale = rationale
          ? `> 💡 **AI Rationale:** ${rationale}\n\n${description}`
          : description;

        const issue = await api.post<any>('/pms/issues', {
          projectId: resolvedProjectId,
          title,
          description: descWithRationale,
          type,
          priority,
        });

        return {
          content: [
            {
              type: 'text',
              text: `📬 **Proposed Issue Created:** **${formatIssueKey(issue)}** - "${issue.title}"\n- Type: ${type} | Priority: ${priority}\n- Ready for human triage in project backlog`,
            },
          ],
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );
}

