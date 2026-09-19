import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { ProjectRepository } from "../dist/repositories/ProjectRepository.js";
import { SprintRepository } from "../dist/repositories/SprintRepository.js";
import { TaskRepository } from "../dist/repositories/TaskRepository.js";
import { ProjectService } from "../dist/services/ProjectService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, "..", "dist", "db", "schema.sql");

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-listprojects-"));
  const dbPath = path.join(tmpDir, "taskmanager.db");
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));

  const projectRepository = new ProjectRepository(db);
  const taskRepository = new TaskRepository(db);
  const sprintRepository = new SprintRepository(db);
  const service = new ProjectService(
    db,
    projectRepository,
    taskRepository,
    sprintRepository
  );

  try {
    // Empty database returns an empty array.
    const empty = await service.listProjects();
    assert.deepEqual(empty, [], "listProjects returns [] when there are no projects");

    // Insert three projects with distinct creation timestamps.
    projectRepository.create({
      project_id: "11111111-1111-4111-8111-111111111111",
      name: "Oldest",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    projectRepository.create({
      project_id: "22222222-2222-4222-8222-222222222222",
      name: "Middle",
      created_at: "2026-06-01T00:00:00.000Z",
    });
    projectRepository.create({
      project_id: "33333333-3333-4333-8333-333333333333",
      name: "Newest",
      created_at: "2026-12-01T00:00:00.000Z",
    });

    const projects = await service.listProjects();
    assert.equal(projects.length, 3, "listProjects returns all projects");

    // Ordered newest-first.
    assert.deepEqual(
      projects.map((p) => p.name),
      ["Newest", "Middle", "Oldest"],
      "projects are ordered by creation date descending"
    );

    // Each project exposes the expected shape.
    for (const project of projects) {
      assert.ok(project.project_id, "project has an id");
      assert.ok(project.name, "project has a name");
      assert.ok(project.created_at, "project has a created_at");
    }

    console.log("listProjects tests passed");
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
