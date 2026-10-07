/**
 * Token-optimized response formatters for LLM consumption.
 * Reduces context window bloat by 80-90% compared to raw database JSON dumps.
 */

export function extractPlainText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return extractPlainText(parsed);
    } catch {
      return content;
    }
  }

  if (Array.isArray(content)) {
    return content.map(extractPlainText).filter(Boolean).join('\n');
  }

  if (typeof content === 'object') {
    if (content.text) return content.text;
    if (content.content) return extractPlainText(content.content);
    if (content.children) return extractPlainText(content.children);
  }

  return '';
}

export function formatIssueKey(issue: any): string {
  const projectKey = issue.project?.key || issue.projectKey || '';
  const num = issue.issueNumber;
  if (projectKey && num !== undefined) {
    return `${projectKey}-${num}`;
  }
  return issue.id || 'UNKNOWN';
}

export function formatIssueTableRow(issue: any): string {
  const key = formatIssueKey(issue);
  const title = (issue.title || '').replace(/\|/g, '\\|').trim();
  const status = issue.status?.name || issue.status?.category || 'Unknown';
  const priority = issue.priority || 'NORMAL';
  const assignees = (issue.assignees || [])
    .map((a: any) => a.user?.name || a.name || 'Unknown')
    .join(', ') || 'Unassigned';
  const estimate = issue.estimate !== null && issue.estimate !== undefined ? `${issue.estimate} pts` : '-';

  return `| ${key} | ${title} | ${status} | ${priority} | ${assignees} | ${estimate} |`;
}

export function formatIssueList(issues: any[], title?: string): string {
  if (!issues || issues.length === 0) {
    return title ? `### ${title}\n*No issues found.*` : '*No issues found.*';
  }

  const header = `| Key | Title | Status | Priority | Assignees | Est |\n| :--- | :--- | :--- | :--- | :--- | :--- |`;
  const rows = issues.map(formatIssueTableRow).join('\n');
  const summary = `\n*Showing ${issues.length} issue(s)*`;

  return title ? `### ${title}\n${header}\n${rows}\n${summary}` : `${header}\n${rows}\n${summary}`;
}

export function formatIssueDetail(issue: any): string {
  const key = formatIssueKey(issue);
  const title = issue.title || '';
  const status = issue.status?.name || issue.status?.category || 'Unknown';
  const priority = issue.priority || 'NORMAL';
  const type = issue.type || 'TASK';
  const estimate = issue.estimate !== null && issue.estimate !== undefined ? `${issue.estimate} pts` : 'None';
  const dueDate = issue.dueDate ? new Date(issue.dueDate).toISOString().split('T')[0] : 'None';
  const assignees = (issue.assignees || [])
    .map((a: any) => a.user?.name || a.user?.email || 'Unknown')
    .join(', ') || 'Unassigned';
  const reporter = issue.reporter?.name || issue.reporter?.email || 'Unknown';
  const projectName = issue.project?.name ? `${issue.project.name} (${issue.project.key})` : '';

  let description = extractPlainText(issue.description);
  if (!description.trim()) description = '_No description provided._';

  let subtasksSection = '';
  if (issue.subIssues && issue.subIssues.length > 0) {
    const subtaskLines = issue.subIssues.map((sub: any) => {
      const subKey = formatIssueKey({ ...sub, project: issue.project });
      const done = sub.status?.category === 'DONE' ? '[x]' : '[ ]';
      return `- ${done} **${subKey}**: ${sub.title} (${sub.status?.name || 'Open'})`;
    });
    subtasksSection = `\n\n### Subtasks\n${subtaskLines.join('\n')}`;
  }

  let commentsSection = '';
  if (issue.comments && issue.comments.length > 0) {
    const commentLines = issue.comments.slice(0, 5).map((c: any) => {
      const author = c.user?.name || 'User';
      const time = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '';
      const text = extractPlainText(c.content || c.body || c.text);
      return `> **${author}** (${time}):\n> ${text}\n`;
    });
    commentsSection = `\n\n### Recent Comments (${issue.comments.length})\n${commentLines.join('\n')}`;
  }

  return `## [${key}] ${title}
- **Project**: ${projectName}
- **Status**: ${status} | **Priority**: ${priority} | **Type**: ${type}
- **Assignee**: ${assignees} | **Reporter**: ${reporter}
- **Estimate**: ${estimate} | **Due Date**: ${dueDate}

### Description
${description}${subtasksSection}${commentsSection}`;
}

export function formatProjectsList(projects: any[]): string {
  if (!projects || projects.length === 0) return '*No projects found.*';

  const header = `| Key | Project Name | Lead | Issues | Statuses |\n| :--- | :--- | :--- | :--- | :--- |`;
  const rows = projects
    .map((p: any) => {
      const key = (p.key || '').toUpperCase();
      const name = (p.name || '').replace(/\|/g, '\\|');
      const lead = p.lead?.name || 'None';
      const issuesCount = p._count?.issues ?? '-';
      const statuses = (p.workflowStatuses || []).map((s: any) => s.name).join(', ') || 'Default';
      return `| **${key}** | ${name} | ${lead} | ${issuesCount} | ${statuses} |`;
    })
    .join('\n');

  return `### Projects Overview\n${header}\n${rows}`;
}
