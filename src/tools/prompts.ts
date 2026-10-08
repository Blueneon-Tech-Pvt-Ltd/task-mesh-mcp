import { ApiClient } from '../client/api-client.js';
import { EntityResolver } from '../client/resolver.js';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatPrompt(p: any): string {
  const deps = p.dependsOn?.length
    ? `\n**Dependencies met:** ${p.dependsOn.join(', ')}`
    : p.depends_on?.length
    ? `\n**Dependencies met:** ${p.depends_on.join(', ')}`
    : '';

  const issues = p.linkedIssues?.length
    ? `\n**Linked issues:** ${p.linkedIssues.join(', ')}`
    : p.linked_issues?.length
    ? `\n**Linked issues:** ${p.linked_issues.join(', ')}`
    : '';

  const model = p.targetModel || p.target_model ? `\n**Target model:** ${p.targetModel || p.target_model}` : '';

  const vars = p.variablesCompiled || p.variables_compiled
    ? `\n**Variables compiled:** ${Object.entries(p.variablesCompiled || p.variables_compiled)
        .map(([k, v]) => `\`${k}\` = "${v}"`)
        .join(', ')}`
    : '';

  return [
    `## ${p.title}`,
    `**ID:** \`${p.id}\`  |  **Module:** ${p.module ?? 'General'}  |  **Status:** ${p.status}`,
    deps,
    issues,
    model,
    vars,
    '',
    '---',
    '',
    p.body,
  ]
    .filter((l) => l !== null && l !== undefined)
    .join('\n');
}

// ─── Tool Registration ─────────────────────────────────────────────────────────

export function registerPromptKitTools(server: any, api: ApiClient, resolver: EntityResolver) {
  // ── 1. get_next_prompt ────────────────────────────────────────────────────
  server.tool(
    'get_next_prompt',
    'Returns the next executable Prompt Kit entry for a project whose dependency chain is fully satisfied. Variables are pre-compiled from project context. Call this at the start of an autonomous work session.',
    {
      projectId: {
        type: 'string',
        description: 'Project key (e.g. "ALPHA") or UUID',
      },
      module: {
        type: 'string',
        description: 'Optional: filter by collection/module name (e.g. "Phase 1 — Auth")',
        required: false,
      },
    },
    async ({ projectId, module: moduleName }: { projectId: string; module?: string }) => {
      try {
        const resolvedId = await resolver.resolveProjectId(projectId);
        const prompt = await api.get<any>(`/prompt-kit/${resolvedId}/next`, {
          ...(moduleName ? { module: moduleName } : {}),
        });

        if (!prompt) {
          return {
            content: [
              {
                type: 'text',
                text: `✅ No ready prompts found for project **${projectId}**${moduleName ? ` in module "${moduleName}"` : ''}.\n\nAll tasks may be complete, in-progress, or waiting on dependencies.`,
              },
            ],
          };
        }

        return {
          content: [{ type: 'text', text: formatPrompt(prompt) }],
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  // ── 2. claim_prompt ───────────────────────────────────────────────────────
  server.tool(
    'claim_prompt',
    'Atomically claims a Prompt Kit entry, transitioning it from "ready" to "in_progress". Prevents two agents from working on the same prompt simultaneously. Returns the full prompt body ready for execution.',
    {
      id: {
        type: 'string',
        description: 'Prompt ID (e.g. UUID)',
      },
      agentId: {
        type: 'string',
        description: 'Optional string identifier for the claiming agent',
        required: false,
      },
    },
    async ({ id, agentId }: { id: string; agentId?: string }) => {
      try {
        const result = await api.patch<any>(`/prompt-kit/prompts/${id}/claim`, {
          agentId: agentId || 'autonomous-agent',
        });

        return {
          content: [
            {
              type: 'text',
              text: [
                `✅ **Claimed:** ${result.title}`,
                `**Expires at:** ${result.claimExpiresAt || result.claim_expires_at} (auto-released if not reported)`,
                '',
                '---',
                '',
                formatPrompt(result),
              ].join('\n'),
            },
          ],
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  // ── 3. release_claim ──────────────────────────────────────────────────────
  server.tool(
    'release_claim',
    'Releases a claimed prompt back to "ready" state. Call this if you cannot complete the task (wrong scope, blocked, prerequisite missing). Include a reason so the next agent or human knows why.',
    {
      id: {
        type: 'string',
        description: 'Prompt ID to release',
      },
      reason: {
        type: 'string',
        description:
          'Why you are releasing: "blocked", "wrong_scope", "prerequisite_missing", or free text describing the blocker.',
        required: false,
      },
    },
    async ({ id, reason }: { id: string; reason?: string }) => {
      try {
        await api.patch<any>(`/prompt-kit/prompts/${id}/release`, { reason });

        return {
          content: [
            {
              type: 'text',
              text: `🔓 Released prompt \`${id}\` back to **ready** state.${reason ? `\n\n**Reason logged:** ${reason}` : ''}`,
            },
          ],
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  // ── 4. report_result ──────────────────────────────────────────────────────
  server.tool(
    'report_result',
    'Reports the outcome of executing a claimed prompt. Transitions the prompt to "executed" and stores an immutable execution log entry. This is the write-back tool — always call it when you finish (or partially finish) a task.',
    {
      id: {
        type: 'string',
        description: 'Prompt ID that was executed',
      },
      status: {
        type: 'string',
        description:
          'Outcome: "completed" (fully done), "partial" (some done, see notes), "failed" (could not do it), "blocked" (waiting on external thing)',
      },
      summary: {
        type: 'string',
        description: '1-3 sentence human-readable description of what was done or why it failed.',
      },
      files_changed: {
        type: 'array',
        description: 'Optional list of file paths that were created or modified.',
        items: { type: 'string' },
        required: false,
      },
      pr_url: {
        type: 'string',
        description: 'Optional: URL to the pull request created as part of this task.',
        required: false,
      },
      commit_sha: {
        type: 'string',
        description: 'Optional: Git commit SHA if a commit was made.',
        required: false,
      },
      notes: {
        type: 'string',
        description:
          'Optional: Technical observations, gotchas, caveats, or things the next agent should know. This is prepended to the prompt body on requeue if status is partial/blocked.',
        required: false,
      },
      suggested_next: {
        type: 'string',
        description:
          'Optional: Prompt ID or title of the prompt the agent recommends running next. Used for surfacing in the UI.',
        required: false,
      },
    },
    async (params: {
      id: string;
      status: 'completed' | 'partial' | 'failed' | 'blocked';
      summary: string;
      files_changed?: string[];
      pr_url?: string;
      commit_sha?: string;
      notes?: string;
      suggested_next?: string;
    }) => {
      try {
        const result = await api.post<any>(`/prompt-kit/prompts/${params.id}/report`, {
          status: params.status,
          summary: params.summary,
          files_changed: params.files_changed,
          pr_url: params.pr_url,
          commit_sha: params.commit_sha,
          notes: params.notes,
          suggested_next: params.suggested_next,
        });

        const statusIcon =
          params.status === 'completed'
            ? '✅'
            : params.status === 'partial'
            ? '⚠️'
            : params.status === 'failed'
            ? '❌'
            : '🔒';

        return {
          content: [
            {
              type: 'text',
              text: [
                `${statusIcon} **${params.status.toUpperCase()}:** ${result.title}`,
                `**Execution ID:** \`${result.executionId || result.execution_id}\``,
                '',
                `**Summary:** ${params.summary}`,
                params.files_changed?.length
                  ? `\n**Files changed:**\n${params.files_changed.map((f) => `- \`${f}\``).join('\n')}`
                  : '',
                params.pr_url ? `\n**PR:** ${params.pr_url}` : '',
                params.notes ? `\n**Notes logged:** ${params.notes}` : '',
                params.suggested_next
                  ? `\n**Suggested next:** ${params.suggested_next}`
                  : '',
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  // ── 5. propose_prompt ─────────────────────────────────────────────────────
  server.tool(
    'propose_prompt',
    'Proposes a NEW Prompt Kit entry for human review. The prompt lands in "proposed" state and is visible in the UI for approval — it will NOT be executed by any agent until a human approves it. Use this to extend the playbook based on what you discover during execution.',
    {
      projectId: {
        type: 'string',
        description: 'Project key or UUID this prompt belongs to',
      },
      title: {
        type: 'string',
        description: 'Short, descriptive title for the prompt',
      },
      body: {
        type: 'string',
        description: 'Full prompt body in Markdown format',
      },
      module: {
        type: 'string',
        description: 'Optional: Collection/module name (e.g. "Phase 2 — Dashboard")',
        required: false,
      },
      depends_on: {
        type: 'array',
        description: 'Optional: Prompt IDs that must be executed before this one.',
        items: { type: 'string' },
        required: false,
      },
      linked_issues: {
        type: 'array',
        description: 'Optional: Issue keys to link (e.g. ["ALPHA-17"])',
        items: { type: 'string' },
        required: false,
      },
      target_model: {
        type: 'string',
        description: 'Optional: Suggested AI model (e.g. "claude-3-5-sonnet", "gpt-4o")',
        required: false,
      },
      rationale: {
        type: 'string',
        description:
          'WHY you are proposing this. Shown to the human reviewer. Be specific — what gap does this address?',
      },
    },
    async (params: {
      projectId: string;
      title: string;
      body: string;
      module?: string;
      depends_on?: string[];
      linked_issues?: string[];
      target_model?: string;
      rationale: string;
    }) => {
      try {
        const resolvedId = await resolver.resolveProjectId(params.projectId);
        const result = await api.post<any>(`/prompt-kit/${resolvedId}/prompts`, {
          title: params.title,
          body: params.body,
          module: params.module,
          dependsOn: params.depends_on,
          linkedIssues: params.linked_issues,
          targetModel: params.target_model,
          rationale: params.rationale,
          status: 'PROPOSED',
        });

        return {
          content: [
            {
              type: 'text',
              text: [
                `📬 **Proposal submitted:** "${params.title}"`,
                `**Proposal ID:** \`${result.id}\``,
                `**Status:** Awaiting human review`,
                '',
                `**Rationale:** ${params.rationale}`,
              ].join('\n'),
            },
          ],
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  // ── 6. propose_revision ───────────────────────────────────────────────────
  server.tool(
    'propose_revision',
    'Proposes an edit to an EXISTING Prompt Kit entry. The revision lands as a pending diff in the UI — the human sees before/after and approves or rejects. Use this to improve prompts based on lessons learned during execution.',
    {
      id: {
        type: 'string',
        description: 'ID of the existing prompt to revise',
      },
      revised_body: {
        type: 'string',
        description:
          'The full revised prompt body (diff is computed server-side). Provide the complete new body, not just changes.',
      },
      rationale: {
        type: 'string',
        description:
          'Why this revision is needed. What was wrong or incomplete in the original? Be specific.',
      },
      execution_id: {
        type: 'string',
        description:
          'Optional: ID of the execution log entry that prompted this revision (links the revision to the evidence).',
        required: false,
      },
    },
    async (params: {
      id: string;
      revised_body: string;
      rationale: string;
      execution_id?: string;
    }) => {
      try {
        const result = await api.post<any>(`/prompt-kit/prompts/${params.id}/revisions`, {
          revisedBody: params.revised_body,
          rationale: params.rationale,
          executionId: params.execution_id,
        });

        return {
          content: [
            {
              type: 'text',
              text: [
                `📝 **Revision proposed** for prompt \`${params.id}\``,
                `**Revision ID:** \`${result.revisionId || result.revision_id}\``,
                `**Status:** Awaiting human review`,
                '',
                `**Rationale:** ${params.rationale}`,
                result.diffSummary || result.diff_summary
                  ? `\n**Diff summary:** ${result.diffSummary || result.diff_summary}`
                  : '',
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );

  // ── 7. get_context_doc ────────────────────────────────────────────────────
  server.tool(
    'get_context_doc',
    'Fetches a named context document for a project — coding standards, architecture notes, API contracts, style guides. Ground yourself with these before executing prompts.',
    {
      projectId: {
        type: 'string',
        description: 'Project key or UUID',
      },
      name: {
        type: 'string',
        description:
          'Document name. Built-in: "coding_standards", "architecture", "stack", "api_contracts". Or any custom doc name.',
      },
    },
    async ({ projectId, name }: { projectId: string; name: string }) => {
      try {
        const resolvedId = await resolver.resolveProjectId(projectId);
        const doc = await api.get<any>(
          `/prompt-kit/${resolvedId}/context/${encodeURIComponent(name)}`
        );

        return {
          content: [
            {
              type: 'text',
              text: [
                `# Context: ${doc.title ?? name}`,
                `_Last updated: ${doc.updatedAt || doc.updated_at}_`,
                '',
                doc.content,
              ].join('\n'),
            },
          ],
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    }
  );
}
