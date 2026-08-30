# MCP Task Manager Server

<div align="center">
  <img src="public/images/mcp-task-manager-logo.svg" alt="MCP Task Manager Logo" width="200" height="200" />
</div>

A local Model Context Protocol (MCP) server providing backend tools for client-driven project and task management using a SQLite database.

## Overview

This server acts as a persistent backend for local MCP clients (like AI agents or scripts) that need to manage structured task data within distinct projects. It handles data storage and provides a standardized set of tools for interaction, while the strategic workflow logic resides within the client.

**Key Features:**

* **Project-Based:** Tasks are organized within distinct projects.
* **SQLite Persistence:** Uses a local SQLite file (`./data/taskmanager.db` by default) for simple, self-contained data storage.
* **Client-Driven:** Provides tools for clients; does not dictate workflow.
* **MCP Compliant:** Adheres to the Model Context Protocol for tool definition and communication.
* **Work Item Management:** Supports epics, stories, tasks, parent-child hierarchy, dependencies, status changes, and next actionable task selection.
* **Sprint Management:** Supports sprint planning, activation, backlog assignment, progress reporting, and closing sprints with their assigned work.
* **Import/Export:** Allows exporting project data to JSON and importing from JSON to create new projects.

## Implemented MCP Tools

The following tools are available for MCP clients:

* **`createProject`**:
  * **Description:** Creates a new, empty project.
  * **Params:** `projectName` (string, optional, max 255)
  * **Returns:** `{ project_id: string }`
* **`addTask`**:
  * **Description:** Adds a new work item to a project. Defaults to a task for backward compatibility.
  * **Params:** `project_id` (string, required, UUID), `description` (string, required, 1-1024), `item_type` (enum 'epic'|'story'|'task', optional, default 'task'), `parent_task_id` (UUID|null, optional), `sprint_id` (UUID|null, optional), `dependencies` (string[], optional, max 50), `priority` (enum 'high'|'medium'|'low', optional, default 'medium'), `status` (enum 'todo'|'in-progress'|'review'|'done', optional, default 'todo')
  * **Returns:** Full `TaskData` object of the created task.
* **`createEpic`**:
  * **Description:** Creates a top-level epic in a project.
  * **Params:** `project_id` (string, required, UUID), `description` (string, required), `priority` (optional), `status` (optional)
  * **Returns:** Created epic work item.
* **`listEpics`**:
  * **Description:** Lists epics, optionally including nested stories and tasks.
  * **Params:** `project_id` (string, required, UUID), `status` (optional), `include_subtasks` (boolean, optional, default true)
  * **Returns:** Epic work items.
* **`createStory`**:
  * **Description:** Creates a story under an epic, optionally assigning it to a sprint.
  * **Params:** `project_id` (string, required, UUID), `epic_id` (string, required, UUID), `description` (string, required), `sprint_id` (UUID|null, optional), `priority` (optional), `status` (optional)
  * **Returns:** Created story work item.
* **`listStories`**:
  * **Description:** Lists stories, optionally scoped to an epic or sprint and optionally including nested tasks.
  * **Params:** `project_id` (string, required, UUID), `epic_id` (optional), `sprint_id` (optional), `status` (optional), `include_subtasks` (boolean, optional, default true)
  * **Returns:** Story work items.
* **`listTasks`**:
  * **Description:** Lists work items for a project, with optional status/type/sprint/parent filtering and nested child inclusion.
  * **Params:** `project_id` (string, required, UUID), `status` (enum 'todo'|'in-progress'|'review'|'done', optional), `item_type` (optional), `sprint_id` (UUID|null, optional), `parent_task_id` (UUID|null, optional), `include_subtasks` (boolean, optional, default false)
  * **Returns:** Array of `TaskData` or `StructuredTaskData` objects.
* **`showTask`**:
  * **Description:** Retrieves full details for a specific task, including dependencies and direct subtasks.
  * **Params:** `project_id` (string, required, UUID), `task_id` (string, required)
  * **Returns:** `FullTaskData` object.
* **`setTaskStatus`**:
  * **Description:** Updates the status of one or more tasks.
  * **Params:** `project_id` (string, required, UUID), `task_ids` (string[], required, 1-100), `status` (enum 'todo'|'in-progress'|'review'|'done', required)
  * **Returns:** `{ success: true, updated_count: number }`
* **`closeTask`**:
  * **Description:** Marks a work item as done. By default also closes all descendants.
  * **Params:** `project_id` (string, required, UUID), `task_id` (string, required, UUID), `include_subtasks` (boolean, optional, default true)
  * **Returns:** `{ closed_count: number, task_ids: string[] }`
* **`expandTask`**:
  * **Description:** Breaks a parent task into subtasks, optionally replacing existing ones.
  * **Params:** `project_id` (string, required, UUID), `task_id` (string, required), `subtask_descriptions` (string[], required, 1-20, each 1-512), `force` (boolean, optional, default false)
  * **Returns:** Updated parent `FullTaskData` object including new subtasks.
* **`getNextTask`**:
  * **Description:** Identifies the next actionable executable task based on status ('todo'), dependencies ('done'), priority, and creation date. If `sprint_id` is omitted, the most recent active sprint is used when one exists.
  * **Params:** `project_id` (string, required, UUID), `sprint_id` (string, optional, UUID)
  * **Returns:** `FullTaskData` object of the next task, or `null` if none are ready.
* **`createSprint`**:
  * **Description:** Creates a sprint in a project.
  * **Params:** `project_id` (string, required, UUID), `name` (string, required), `goal` (string|null, optional), `start_date` (YYYY-MM-DD|null, optional), `end_date` (YYYY-MM-DD|null, optional), `status` (enum 'planned'|'active'|'closed', optional)
  * **Returns:** Created sprint.
* **`listSprints`**:
  * **Description:** Lists project sprints, optionally filtered by status.
  * **Params:** `project_id` (string, required, UUID), `status` (optional)
  * **Returns:** Array of sprints.
* **`updateSprint`**:
  * **Description:** Updates sprint name, goal, dates, or status.
  * **Params:** `project_id` (string, required, UUID), `sprint_id` (string, required, UUID), and at least one of `name`, `goal`, `start_date`, `end_date`, `status`
  * **Returns:** Updated sprint.
* **`startSprint`**:
  * **Description:** Marks a sprint active. By default, other active sprints in the project are moved back to planned.
  * **Params:** `project_id` (string, required, UUID), `sprint_id` (string, required, UUID), `make_exclusive` (boolean, optional, default true)
  * **Returns:** `{ sprint, deactivated_sprint_count }`
* **`assignToSprint`**:
  * **Description:** Bulk assigns or unassigns stories/tasks to a sprint. Epics cannot be assigned directly.
  * **Params:** `project_id` (string, required, UUID), `task_ids` (string[], required), `sprint_id` (UUID|null, required)
  * **Returns:** `{ assigned_count: number, sprint_id: string|null }`
* **`closeSprint`**:
  * **Description:** Closes a sprint and, by default, marks all assigned work items done.
  * **Params:** `project_id` (string, required, UUID), `sprint_id` (string, required, UUID), `close_tasks` (boolean, optional, default true)
  * **Returns:** `{ sprint_id: string, closed_task_count: number }`
* **`getSprintProgress`**:
  * **Description:** Computes sprint progress from assigned tasks, including done/open counts and status breakdown.
  * **Params:** `project_id` (string, required, UUID), `sprint_id` (string, required, UUID)
  * **Returns:** Sprint progress summary.
* **`getSprintBacklog`**:
  * **Description:** Returns sprint work grouped by available epic/story hierarchy.
  * **Params:** `project_id` (string, required, UUID), `sprint_id` (string, required, UUID)
  * **Returns:** Structured backlog.
* **`getEpicProgress`**:
  * **Description:** Computes epic progress from descendant stories and tasks.
  * **Params:** `project_id` (string, required, UUID), `epic_id` (string, required, UUID)
  * **Returns:** Epic progress summary.
* **`exportProject`**:
  * **Description:** Exports complete project data as a JSON string.
  * **Params:** `project_id` (string, required, UUID), `format` (enum 'json', optional, default 'json')
  * **Returns:** JSON string representing the project.
* **`importProject`**:
  * **Description:** Creates a *new* project from an exported JSON string.
  * **Params:** `project_data` (string, required, JSON), `new_project_name` (string, optional, max 255)
  * **Returns:** `{ project_id: string }` of the newly created project.
* **`updateTask`**:
  * **Description:** Updates specific details of an existing work item.
  * **Params:** `project_id` (string, required, UUID), `task_id` (string, required, UUID), `description` (string, optional, 1-1024), `priority` (enum 'high'|'medium'|'low', optional), `parent_task_id` (UUID|null, optional), `sprint_id` (UUID|null, optional), `dependencies` (string[], optional, max 50, replaces existing)
  * **Returns:** Updated `FullTaskData` object.
* **`deleteTask`**:
  * **Description:** Deletes one or more tasks (and their subtasks/dependency links via cascade).
  * **Params:** `project_id` (string, required, UUID), `task_ids` (string[], required, 1-100)
  * **Returns:** `{ success: true, deleted_count: number }`
* **`deleteProject`**:
  * **Description:** Permanently deletes a project and ALL associated data. **Use with caution!**
  * **Params:** `project_id` (string, required, UUID)
  * **Returns:** `{ success: true }`

*(Note: Refer to the corresponding `src/tools/*Params.ts` files for detailed Zod schemas and parameter descriptions.)*

## Getting Started

1. **Prerequisites:** Node.js (LTS recommended), npm.
2. **Install Dependencies:**

    ```bash
    npm install
    ```

3. **Run in Development Mode:** (Uses `ts-node` and `nodemon` for auto-reloading)

    ```bash
    npm run dev
    ```

    The server will connect via stdio. Logs (JSON format) will be printed to stderr. The SQLite database will be created/updated in `./data/taskmanager.db`.
4. **Build for Production:**

    ```bash
    npm run build
    ```

5. **Run Production Build:**

    ```bash
    npm start
    ```

## Configuration

* **Database Path:** The location of the SQLite database file can be overridden by setting the `DATABASE_PATH` environment variable. The default is `./data/taskmanager.db`.
* **Log Level:** The logging level can be set using the `LOG_LEVEL` environment variable (e.g., `debug`, `info`, `warn`, `error`). The default is `info`.

## Project Structure

* `/src`: Source code.
  * `/config`: Configuration management.
  * `/db`: Database manager and schema (`schema.sql`).
  * `/repositories`: Data access layer (SQLite interaction).
  * `/services`: Core business logic.
  * `/tools`: MCP tool definitions (*Params.ts) and implementation (*Tool.ts).
  * `/types`: Shared TypeScript interfaces (currently minimal, mostly in repos/services).
  * `/utils`: Logging, custom errors, etc.
  * `createServer.ts`: Server instance creation.
  * `server.ts`: Main application entry point.
* `/dist`: Compiled JavaScript output.
* `/docs`: Project documentation (PRD, Feature Specs, RFC).
* `/data`: Default location for the SQLite database file (created automatically).
* `tasks.md`: Manual task tracking file for development.
* Config files (`package.json`, `tsconfig.json`, `.eslintrc.json`, etc.)

## Linting and Formatting

* **Lint:** `npm run lint`
* **Format:** `npm run format`

(Code is automatically linted/formatted on commit via Husky/lint-staged).
