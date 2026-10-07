# 🔌 TaskMesh MCP Server

The **TaskMesh Model Context Protocol (MCP) Server** connects your AI coding assistant (Cursor, Claude Desktop, Antigravity, VS Code, Windsurf) directly to your TaskMesh workspace.

It allows AI agents to read tasks, log time, start stopwatches, manage sprints, and update ticket statuses **in 1 shot without context bloat or token waste**.

---

## ⚡ Quick Start (3 Steps)

### 1. Build the MCP Server
```bash
cd mcp
pnpm install
pnpm run build
```

### 2. Generate an API Token
1. Open TaskMesh in your browser.
2. Go to **Settings** ➔ **Developer Settings** (or call `POST /auth/tokens`).
3. Create a token (e.g. `Cursor IDE` with `*` full scope).
4. Copy your token (starts with `tm_...`).

### 3. Add to your AI Editor

#### 🎯 Cursor Setup
1. Open **Cursor Settings** (⚙️) ➔ **Features** ➔ **MCP**.
2. Click **+ Add New MCP Server**:
   * **Name**: `taskmesh`
   * **Type**: `command`
   * **Command**: `node /absolute/path/to/task-mesh/mcp/dist/index.js`
   * **Environment Variables**:
     ```env
     TASKMESH_API_URL=http://localhost:3001
     TASKMESH_API_TOKEN=tm_your_copied_token_here
     ```

#### 🟣 Claude Desktop Setup
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "taskmesh": {
      "command": "node",
      "args": ["/absolute/path/to/task-mesh/mcp/dist/index.js"],
      "env": {
        "TASKMESH_API_URL": "http://localhost:3001",
        "TASKMESH_API_TOKEN": "tm_your_copied_token_here"
      }
    }
  }
}
```

#### 🚀 Antigravity / Windsurf / Custom MCP Clients
```json
{
  "mcpServers": {
    "taskmesh": {
      "command": "node",
      "args": ["/absolute/path/to/task-mesh/mcp/dist/index.js"],
      "env": {
        "TASKMESH_API_URL": "http://localhost:3001",
        "TASKMESH_API_TOKEN": "tm_your_copied_token_here"
      }
    }
  }
}
```

---

## 🤖 AI Assistant Instructions (`AGENTS.md` / `.cursorrules`)

To make your AI agent interact with TaskMesh instantly without wasting round trips, paste this prompt into your project's `AGENTS.md`, `CLAUDE.md`, or `.cursorrules`:

```markdown
### TaskMesh MCP Guidelines for AI Coding Agents
When managing tasks, logging time, or interacting with TaskMesh:

1. **Zero-Hop Lookups**: NEVER make discovery loops (do NOT call `list_projects` then `list_issues` to find an issue).
   - If the user gives a ticket key (e.g., `ALPHA-14`), use `get_issue({ identifier: "ALPHA-14" })` or `start_working_on_issue({ identifier: "ALPHA-14" })` directly.
   - If looking for a task by keyword, use `search_issues({ query: "keyword" })`.

2. **Session Bootstrapping**: At the beginning of a work session, call `get_agent_context()` to get active projects, current sprint, assigned issues, and running timers in ~150 tokens.

3. **Starting Work**: When beginning a task, use `start_working_on_issue({ identifier: "KEY" })`. This atomically updates the status to "In Progress", starts the stopwatch timer, and fetches task requirements in 1 shot.

4. **Updating Status**: Use human status names (e.g. `status: "In Progress"`, `status: "Done"`, `status: "To Do"`). The MCP server resolves the internal workflow status automatically.

5. **Logging Time**: When stopping work, call `stop_timer()` or `log_time({ identifier: "ALPHA-14", hours: 1.5, description: "Implemented feature" })`.
```

---

## 🛠️ Tool Reference

### 🧠 Agent Context & Zero-Hop Workflow
| Tool | Description | Example Input |
| :--- | :--- | :--- |
| `get_agent_context` | 1-shot snapshot of active projects, sprint, my issues, and timer (~150 tokens) | `{}` |
| `start_working_on_issue` | Moves issue to **In Progress**, starts live timer, returns details in 1 call | `{"identifier": "ALPHA-14"}` |
| `search_issues` | Org-wide instant search across all projects | `{"query": "auth token race"}` |

### 📝 Issue Tracking
| Tool | Description | Example Input |
| :--- | :--- | :--- |
| `get_issue` | Get clean Markdown details of an issue | `{"identifier": "ALPHA-14"}` |
| `list_issues` | Compact Markdown table of issues | `{"projectId": "ALPHA", "limit": 10}` |
| `create_issue` | Create issue with project key & status name | `{"projectId": "ALPHA", "title": "Fix login bug", "status": "To Do", "priority": "HIGH"}` |
| `update_issue` | Update status, assignee, or estimate | `{"identifier": "ALPHA-14", "status": "Done"}` |
| `add_comment` | Post a discussion comment | `{"identifier": "ALPHA-14", "content": "PR is ready for review"}` |
| `delete_issue` | Soft delete an issue | `{"identifier": "ALPHA-14"}` |

### ⏱️ Time Tracking
| Tool | Description | Example Input |
| :--- | :--- | :--- |
| `get_active_timer` | View currently running stopwatch timer | `{}` |
| `start_timer` | Start live timer on an issue | `{"identifier": "ALPHA-14"}` |
| `stop_timer` | Stop running timer & record worklog | `{}` |
| `log_time` | Manually log hours to an issue | `{"identifier": "ALPHA-14", "hours": 2, "description": "Fixed bug"}` |
| `list_time_entries` | View logged timesheets | `{"projectId": "ALPHA"}` |

### 📁 Projects & Sprints
| Tool | Description | Example Input |
| :--- | :--- | :--- |
| `list_projects` | Overview table of all projects | `{}` |
| `get_project` | Get project workflow statuses & lead | `{"identifier": "ALPHA"}` |
| `create_project` | Create new project workspace | `{"name": "Website Redesign", "key": "WEB"}` |
| `list_sprints` | List sprints for a project | `{"projectId": "ALPHA"}` |
| `start_sprint` | Mark a sprint as active | `{"id": "sprint-uuid"}` |
| `complete_sprint` | Complete an active sprint | `{"id": "sprint-uuid"}` |

---

## 🔒 Security & Architecture
* **Token-Bucket Rate Limiting**: Protects your API from runaway AI loops.
* **Granular Scopes**: Support for wildcards (`*`) or read-only/write-only scopes (`issues:read`, `time:write`).
* **Clean Audit Logs**: Structured JSON audit logs streamed to `stderr` without interfering with stdio transport.
