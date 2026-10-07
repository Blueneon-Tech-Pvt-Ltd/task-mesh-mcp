# TaskMesh MCP Server

This package implements a production-grade **Model Context Protocol (MCP) Server** for the TaskMesh platform, allowing AI IDEs (such as Cursor, VS Code, and Claude Desktop) to securely interact with the TaskMesh task management and time tracking APIs.

## Features

- **Granular Scopes:** Scoped access tokens (`*`, `projects:read`, `issues:create`, etc.) verified on every API request.
- **Runaway Prevention:** Native rate limiting (token bucket) preventing AI agents from causing runaway loops and high load.
- **Audit Logging:** Clean, structured JSON logs printed directly to `stderr` for visibility within your IDE debug panel.
- **Zero DB Logic Duplication:** Proxies requests through the NestJS REST API, inheriting existing validation, permissions, and soft-delete states.

---

## Installation & Setup

### 1. Build the MCP Server
Inside the `mcp/` directory:
```bash
pnpm install
pnpm run build
```

### 2. Generate a Personal Access Token (PAT)
Currently, PATs are created via the database or by making an authorized POST request to `/auth/tokens` with a JSON body:
```json
{
  "name": "Cursor IDE",
  "scopes": ["*"]
}
```
This returns a token prefixed with `tm_` (e.g. `tm_1d2e3f...`). Copy this token.

---

## IDE Configurations

Add the configuration block below to your IDE's MCP settings, making sure to use the absolute path to your `dist/index.js` file.

### Cursor Settings
Open Cursor and navigate to **Settings** -> **Features** -> **MCP**.
Click **+ Add New MCP Server**:
- **Name:** `taskmesh`
- **Type:** `command`
- **Command:**
```bash
node /absolute/path/to/task-mesh/mcp/dist/index.js
```
- **Environment Variables:**
  - `TASKMESH_API_URL`: `http://localhost:3001`
  - `TASKMESH_API_TOKEN`: `tm_<your_generated_token_here>`

### Claude Desktop Configuration
Add the following to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "taskmesh": {
      "command": "node",
      "args": ["/absolute/path/to/task-mesh/mcp/dist/index.js"],
      "env": {
        "TASKMESH_API_URL": "http://localhost:3001",
        "TASKMESH_API_TOKEN": "tm_<your_generated_token_here>"
      }
}
  }
}
```

### Option B: Remote / NPM Setup (Using npx)
If you publish this package to NPM (e.g. `@task-mesh/mcp-server`), you can configure the IDE to pull it automatically without cloning:

```json
{
  "mcpServers": {
    "taskmesh": {
      "command": "npx",
      "args": ["-y", "@task-mesh/mcp-server"],
      "env": {
        "TASKMESH_API_URL": "https://your-api.domain.com",
        "TASKMESH_API_TOKEN": "tm_<your_generated_token_here>"
      }
    }
  }
}
```

---

## Available Tools

## Agent-Optimized Architecture & Available Tools

The MCP server is designed for zero-hop resolution and token efficiency:
- **Zero-Hop Identifiers**: Accepts human-readable keys (e.g. `ALPHA-14`), project slugs (`ALPHA`), and status names (`"In Progress"`, `"DONE"`).
- **80-90% Context Token Reduction**: Automatically strips Prisma metadata and returns compact Markdown tables/summaries.

### 🧠 Agent Context & Discovery (1-Shot)
- `get_agent_context`: Returns a ~150-token workspace snapshot (projects, active sprint, assigned tasks, running timer). Call this at the start of any conversation.
- `search_issues`: Org-wide fast search by text query, issue key (e.g. `ALPHA-14`), status, or priority.
- `start_working_on_issue`: Atomic 1-shot tool that finds the issue, sets status to `IN_PROGRESS`, starts the live stopwatch timer, and returns details.

### 📁 Projects
- `list_projects`: Lists organization projects with keys, leads, and workflow statuses.
- `get_project`: Gets a project by key (e.g. `ALPHA`) or UUID.
- `create_project`: Creates a new project workspace.
- `update_project`: Updates a project's status, metadata, or dates.

### 📝 Issues
- `list_issues`: Lists issues with compact Markdown tables (project key optional).
- `get_issue`: Retrieves detailed issue state by key (e.g. `ALPHA-14`) or UUID.
- `create_issue`: Creates a new issue using project key and human status/assignee names.
- `update_issue`: Updates title, description, status (e.g. `"In Progress"`), estimate, or assignees.
- `delete_issue`: Soft deletes an issue.
- `add_comment`: Adds discussion comments.

### 🏃 Sprints
- `list_sprints`: Lists all sprints for a project using its key (e.g. `ALPHA`).
- `get_sprint`: Gets sprint details and backlog.
- `create_sprint`: Creates a planned sprint.
- `start_sprint`: Moves a sprint from PLANNED to ACTIVE.
- `complete_sprint`: Completes an active sprint.

### ⏱️ Time Tracking
- `get_active_timer`: Checks currently running timer and elapsed time.
- `start_timer`: Starts a timer on a specific issue using its key (`ALPHA-14`).
- `stop_timer`: Stops the current timer and saves the logged duration.
- `log_time`: Submits manual work hours using issue key (`ALPHA-14`).
- `list_time_entries`: Lists time logs with filter options.

