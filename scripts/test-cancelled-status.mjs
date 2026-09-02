import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { ProjectRepository } from "../dist/repositories/ProjectRepository.js";
import { SprintRepository } from "../dist/repositories/SprintRepository.js";
import { TaskRepository } from "../dist/repositories/TaskRepository.js";
import { TaskService } from "../dist/services/TaskService.js";
import { DatabaseManager } from "../dist/db/DatabaseManager.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const sprintId = "22222222-2222-4222-8222-222222222222";
const epicId = "33333333-3333-4333-8333-333333333333";
const doneTaskId = "44444444-4444-4444-8444-444444444444";
const cancelledTaskId = "55555555-5555-4555-8555-555555555555";
const openTaskId = "66666666-6666-4666-8666-666666666666";
const blockedByCancelledId = "77777777-7777-4777-8777-777777777777";
const cancelledSprintId = "88888888-8888-4888-8888-888888888888";
const now = "2026-09-02T00:00:00.000Z";

function createService(db) {
  const projectRepository = new ProjectRepository(db);
  const sprintRepository = new SprintRepository(db);
  const taskRepository = new TaskRepository(db);
  return {
    service: new TaskService(
      db,
      taskRepository,
      projectRepository,
      sprintRepository
    ),
    projectRepository,
    sprintRepository,
    taskRepository,
  };
}

function insertProjectAndSprint(projectRepository, sprintRepository) {
  projectRepository.create({
    project_id: projectId,
    name: "Cancelled state test",
    created_at: now,
  });
  sprintRepository.create({
    sprint_id: sprintId,
    project_id: projectId,
    name: "Sprint 1",
    goal: null,
    milestone: null,
    start_date: null,
    end_date: null,
    status: "active",
    created_at: now,
    updated_at: now,
  });
}

function insertTask(taskRepository, task) {
  taskRepository.create(
    {
      parent_task_id: null,
      sprint_id: null,
      milestone: null,
      item_type: "task",
      priority: "medium",
      created_at: now,
      updated_at: now,
      ...task,
      project_id: projectId,
    },
    task.dependencies ?? []
  );
}

function testCancelledCountsAsDone() {
  const db = new Database(":memory:");
  db.exec(fs.readFileSync(path.resolve("dist/db/schema.sql"), "utf8"));
  const { service, projectRepository, sprintRepository, taskRepository } =
    createService(db);
  insertProjectAndSprint(projectRepository, sprintRepository);

  insertTask(taskRepository, {
    task_id: epicId,
    item_type: "epic",
    description: "Epic",
    status: "todo",
  });
  insertTask(taskRepository, {
    task_id: doneTaskId,
    parent_task_id: epicId,
    sprint_id: sprintId,
    description: "Done task",
    status: "done",
  });
  insertTask(taskRepository, {
    task_id: cancelledTaskId,
    parent_task_id: epicId,
    sprint_id: sprintId,
    description: "Cancelled task",
    status: "cancelled",
  });
  insertTask(taskRepository, {
    task_id: openTaskId,
    parent_task_id: epicId,
    sprint_id: sprintId,
    description: "Open task",
    status: "todo",
  });
  insertTask(taskRepository, {
    task_id: blockedByCancelledId,
    sprint_id: sprintId,
    description: "Ready because dependency is cancelled",
    status: "todo",
    dependencies: [cancelledTaskId],
  });

  return Promise.all([
    service.getSprintProgress(projectId, sprintId),
    service.getEpicProgress(projectId, epicId),
    service.getNextTask(projectId, sprintId),
  ]).then(([sprintProgress, epicProgress, nextTask]) => {
    assert.equal(sprintProgress.done_tasks, 2);
    assert.equal(sprintProgress.open_tasks, 2);
    assert.equal(sprintProgress.progress_percent, 50);
    assert.equal(sprintProgress.by_status.cancelled, 1);

    assert.equal(epicProgress.done_tasks, 2);
    assert.equal(epicProgress.open_tasks, 1);
    assert.equal(epicProgress.progress_percent, 67);
    assert.equal(epicProgress.by_status.cancelled, 1);

    assert.equal(nextTask?.task_id, openTaskId);
    assert.equal(
      taskRepository.findByProjectId(projectId, { status: "cancelled" }).length,
      1
    );
    db.close();
  });
}

function testMigrationAllowsCancelledStatuses() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-task-cancelled-"));
  const dbPath = path.join(tmpDir, "taskmanager.db");
  const db = new Database(dbPath);
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE projects (
      project_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE sprints (
      sprint_id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      goal TEXT NULL,
      milestone TEXT NULL,
      start_date TEXT NULL,
      end_date TEXT NULL,
      status TEXT NOT NULL CHECK(status IN ('planned', 'active', 'closed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
    );

    CREATE TABLE tasks (
      task_id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      parent_task_id TEXT NULL,
      sprint_id TEXT NULL,
      item_type TEXT NOT NULL DEFAULT 'task' CHECK(item_type IN ('epic', 'story', 'task')),
      milestone TEXT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('todo', 'in-progress', 'review', 'done')),
      priority TEXT NOT NULL CHECK(priority IN ('high', 'medium', 'low')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
      FOREIGN KEY (parent_task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
      FOREIGN KEY (sprint_id) REFERENCES sprints(sprint_id) ON DELETE SET NULL
    );

    CREATE TABLE task_dependencies (
      task_id TEXT NOT NULL,
      depends_on_task_id TEXT NOT NULL,
      PRIMARY KEY (task_id, depends_on_task_id),
      FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
      FOREIGN KEY (depends_on_task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
    );
  `);
  db.close();

  process.env.DATABASE_PATH = dbPath;
  const manager = DatabaseManager.getInstance();
  const migratedDb = manager.getDb();
  migratedDb
    .prepare(
      "INSERT INTO projects (project_id, name, created_at) VALUES (?, ?, ?)"
    )
    .run(projectId, "Migrated", now);
  migratedDb
    .prepare(
      `
    INSERT INTO sprints (
      sprint_id, project_id, name, goal, milestone, start_date, end_date, status, created_at, updated_at
    )
    VALUES (?, ?, ?, NULL, NULL, NULL, NULL, 'cancelled', ?, ?)
  `
    )
    .run(cancelledSprintId, projectId, "Cancelled sprint", now, now);
  migratedDb
    .prepare(
      `
    INSERT INTO tasks (
      task_id, project_id, parent_task_id, sprint_id, item_type, milestone, description,
      status, priority, created_at, updated_at
    )
    VALUES (?, ?, NULL, ?, 'task', NULL, 'Cancelled task', 'cancelled', 'medium', ?, ?)
  `
    )
    .run(cancelledTaskId, projectId, cancelledSprintId, now, now);

  assert.equal(
    migratedDb
      .prepare("SELECT status FROM sprints WHERE sprint_id = ?")
      .get(cancelledSprintId).status,
    "cancelled"
  );
  assert.equal(
    migratedDb
      .prepare("SELECT status FROM tasks WHERE task_id = ?")
      .get(cancelledTaskId).status,
    "cancelled"
  );

  manager.closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

await testCancelledCountsAsDone();
testMigrationAllowsCancelledStatuses();
console.log("cancelled status regression tests passed");
