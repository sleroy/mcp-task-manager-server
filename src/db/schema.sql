-- Database schema for the MCP Task Manager Server
-- Based on RFC-2025-001

-- Enable foreign key support
PRAGMA foreign_keys = ON;

-- Use Write-Ahead Logging for better concurrency
PRAGMA journal_mode = WAL;

-- Table: projects
-- Stores project metadata
CREATE TABLE IF NOT EXISTS projects (
    project_id TEXT PRIMARY KEY NOT NULL, -- UUID format
    name TEXT NOT NULL,
    created_at TEXT NOT NULL -- ISO8601 format (e.g., YYYY-MM-DDTHH:MM:SS.SSSZ)
);

-- Table: sprints
-- Stores sprint metadata for a project.
CREATE TABLE IF NOT EXISTS sprints (
    sprint_id TEXT PRIMARY KEY NOT NULL, -- UUID format
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    goal TEXT NULL,
    milestone TEXT NULL,
    start_date TEXT NULL, -- ISO8601 date (YYYY-MM-DD) or null
    end_date TEXT NULL, -- ISO8601 date (YYYY-MM-DD) or null
    status TEXT NOT NULL CHECK(status IN ('planned', 'active', 'closed', 'cancelled')),
    created_at TEXT NOT NULL, -- ISO8601 format
    updated_at TEXT NOT NULL, -- ISO8601 format
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

-- Table: tasks
-- Stores individual task details
CREATE TABLE IF NOT EXISTS tasks (
    task_id TEXT PRIMARY KEY NOT NULL, -- UUID format
    project_id TEXT NOT NULL,
    parent_task_id TEXT NULL, -- For subtasks
    sprint_id TEXT NULL,
    item_type TEXT NOT NULL DEFAULT 'task' CHECK(item_type IN ('epic', 'story', 'task')),
    milestone TEXT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('todo', 'in-progress', 'review', 'done', 'cancelled')),
    priority TEXT NOT NULL CHECK(priority IN ('high', 'medium', 'low')),
    created_at TEXT NOT NULL, -- ISO8601 format
    updated_at TEXT NOT NULL, -- ISO8601 format
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (sprint_id) REFERENCES sprints(sprint_id) ON DELETE SET NULL
);

-- Table: task_dependencies
-- Stores prerequisite relationships between tasks
CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id TEXT NOT NULL, -- The task that depends on another
    depends_on_task_id TEXT NOT NULL, -- The task that must be completed first
    PRIMARY KEY (task_id, depends_on_task_id),
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

-- Indexes for performance optimization

-- Index on tasks table
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_item_type ON tasks(item_type);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

-- Indexes on sprints table
CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);
CREATE INDEX IF NOT EXISTS idx_sprints_milestone ON sprints(milestone);

-- Indexes on task_dependencies table
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on_task_id ON task_dependencies(depends_on_task_id);
