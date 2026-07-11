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

---

## Available Tools

The server registers tools divided into four domains:

### 📁 Projects
- `list_projects`: Lists all organization projects.
- `get_project`: Gets a project by UUID.
- `create_project`: Creates a new project.
- `update_project`: Updates a project's status, metadata, or dates.
- `delete_project`: Deletes a project.
- `add_workflow_status`: Adds a new status column (e.g., "In Review") to a project board.

### 📝 Issues
- `list_issues`: Lists issues (filters by project, status, sprint, type, search term).
- `get_issue`: Retrieves detailed issue state.
- `create_issue`: Creates a new issue (type, description, estimate, priority).
- `update_issue`: Updates title, description, status, sprint, estimate, or assignees.
- `delete_issue`: Deletes an issue.
- `add_comment`: Adds discussion comments.

### 🏃 Sprints
- `list_sprints`: Lists all sprints for a project.
- `get_sprint`: Gets sprint details.
- `create_sprint`: Creates a planned sprint.
- `update_sprint`: Updates sprint dates, goal, or status.
- `start_sprint`: Moves a sprint from PLANNED to ACTIVE.
- `complete_sprint`: Completes an active sprint and handles issue rollover.
- `delete_sprint`: Deletes a sprint.

### ⏱️ Time Tracking
- `log_time`: Submits manual work hours.
- `list_time_entries`: Lists time logs with filter options.
- `get_active_timer`: Checks for currently running stopwatches.
- `start_timer`: Starts a timer on a specific issue.
- `stop_timer`: Stops the current timer and saves it as a time entry.
# task-mesh-mcp
