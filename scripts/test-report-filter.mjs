import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { ProjectRepository } from "../dist/repositories/ProjectRepository.js";
import { SprintRepository } from "../dist/repositories/SprintRepository.js";
import { TaskRepository } from "../dist/repositories/TaskRepository.js";
import { ReportService } from "../dist/services/ReportService.js";
import { ReportServerManager } from "../dist/services/ReportServerManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, "..", "dist", "db", "schema.sql");

const projectId = "11111111-1111-4111-8111-111111111111";
const epicId = "33333333-3333-4333-8333-333333333333";
const openTaskId = "44444444-4444-4444-8444-444444444444";
const doneTaskId = "55555555-5555-4555-8555-555555555555";
const cancelledTaskId = "66666666-6666-4666-8666-666666666666";
const now = "2026-09-02T00:00:00.000Z";

function baseTask(overrides) {
  return {
    project_id: projectId,
    parent_task_id: null,
    sprint_id: null,
    item_type: "task",
    milestone: null,
    status: "todo",
    priority: "medium",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-report-"));
  const dbPath = path.join(tmpDir, "taskmanager.db");
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));

  const projectRepository = new ProjectRepository(db);
  const sprintRepository = new SprintRepository(db);
  const taskRepository = new TaskRepository(db);

  projectRepository.create({
    project_id: projectId,
    name: "Report filter test",
    created_at: now,
  });

  // An epic (open) containing one done task and one cancelled task, plus a
  // top-level open task. This exercises ancestor-retention when filtering.
  taskRepository.create(
    baseTask({ task_id: epicId, item_type: "epic", description: "Epic A", status: "in-progress" }),
    []
  );
  taskRepository.create(
    baseTask({ task_id: doneTaskId, parent_task_id: epicId, description: "Done child", status: "done" }),
    []
  );
  taskRepository.create(
    baseTask({ task_id: cancelledTaskId, parent_task_id: epicId, description: "Cancelled child", status: "cancelled" }),
    []
  );
  taskRepository.create(
    baseTask({ task_id: openTaskId, description: "Open top-level task", status: "todo" }),
    []
  );

  const reportService = new ReportService(
    projectRepository,
    taskRepository,
    sprintRepository
  );
  const manager = new ReportServerManager(reportService);
  const info = await manager.start(0, "127.0.0.1");

  try {
    // 1. HTML includes the new status filter UI and helpers.
    const htmlRes = await fetch(info.url);
    const html = await htmlRes.text();
    assert.ok(html.includes("statusesForFilter"), "HTML should include filter helper");
    assert.ok(html.includes("filterTree"), "HTML should include tree pruning helper");
    assert.ok(html.includes("data-filter="), "HTML should include filter chip binding");
    assert.ok(html.includes("{ key: 'open', label: 'Open' }"), "HTML should define Open chip");
    assert.ok(html.includes("{ key: 'closed', label: 'Closed' }"), "HTML should define Closed chip");
    assert.ok(html.includes('class="filters"'), "HTML should include filters bar");

    // 2. Detail API returns per-node status so the client filter can operate.
    const detailRes = await fetch(info.url + "api/projects/" + projectId);
    assert.equal(detailRes.status, 200);
    const detail = await detailRes.json();
    const epicNode = detail.tree.find((n) => n.task_id === epicId);
    assert.ok(epicNode, "epic node present in tree");
    assert.equal(epicNode.subtasks.length, 2, "epic has two children");
    const statuses = epicNode.subtasks.map((c) => c.status).sort();
    assert.deepEqual(statuses, ["cancelled", "done"], "child statuses present");

    // 3. Replicate the client-side filter to confirm behaviour: filtering to
    //    "open" keeps the open top-level task and the epic (ancestor of no open
    //    child) is dropped since none of its descendants are open.
    const OPEN = ["todo", "in-progress", "review"];
    function filterTree(nodes, allowed) {
      const out = [];
      for (const node of nodes) {
        const kids = node.subtasks && node.subtasks.length ? filterTree(node.subtasks, allowed) : [];
        if (allowed.includes(node.status) || kids.length) {
          out.push({ ...node, subtasks: kids });
        }
      }
      return out;
    }
    const openView = filterTree(detail.tree, OPEN);
    // Epic is in-progress (open) so it is kept, but its done/cancelled children pruned.
    const openEpic = openView.find((n) => n.task_id === epicId);
    assert.ok(openEpic, "in-progress epic retained under Open filter");
    assert.equal(openEpic.subtasks.length, 0, "closed children pruned under Open filter");
    assert.ok(openView.find((n) => n.task_id === openTaskId), "open top-level task retained");

    const closedView = filterTree(detail.tree, ["done", "cancelled"]);
    const closedEpic = closedView.find((n) => n.task_id === epicId);
    assert.ok(closedEpic, "epic retained under Closed filter (has closed descendants)");
    assert.equal(closedEpic.subtasks.length, 2, "both closed children retained under Closed filter");
    assert.ok(!closedView.find((n) => n.task_id === openTaskId), "open task dropped under Closed filter");

    console.log("report filter tests passed");
  } finally {
    await manager.stop();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
