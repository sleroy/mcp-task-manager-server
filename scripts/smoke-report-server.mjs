import { DatabaseManager } from '../dist/db/DatabaseManager.js';
import { ProjectRepository } from '../dist/repositories/ProjectRepository.js';
import { TaskRepository } from '../dist/repositories/TaskRepository.js';
import { SprintRepository } from '../dist/repositories/SprintRepository.js';
import { ReportService } from '../dist/services/ReportService.js';
import { ReportServerManager } from '../dist/services/ReportServerManager.js';
import { randomUUID } from 'node:crypto';

function assert(cond, msg) {
  if (!cond) {
    console.error('ASSERT FAILED:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log('ok -', msg);
}

const now = new Date().toISOString();
const dbManager = DatabaseManager.getInstance();
const db = dbManager.getDb();

const projectRepo = new ProjectRepository(db);
const taskRepo = new TaskRepository(db);
const sprintRepo = new SprintRepository(db);

// Seed data
const projectId = randomUUID();
projectRepo.create({ project_id: projectId, name: 'Smoke Test Project', created_at: now });

const sprintId = randomUUID();
sprintRepo.create({
  sprint_id: sprintId, project_id: projectId, name: 'Sprint 1', goal: 'Ship it',
  milestone: 'M1', start_date: '2026-01-01', end_date: '2026-01-14',
  status: 'active', created_at: now, updated_at: now,
});

const epicId = randomUUID();
taskRepo.create({ task_id: epicId, project_id: projectId, parent_task_id: null, sprint_id: null, milestone: 'M1', item_type: 'epic', description: 'Epic A', status: 'in-progress', priority: 'high', created_at: now, updated_at: now });
const storyId = randomUUID();
taskRepo.create({ task_id: storyId, project_id: projectId, parent_task_id: epicId, sprint_id: sprintId, milestone: 'M1', item_type: 'story', description: 'Story A1', status: 'in-progress', priority: 'medium', created_at: now, updated_at: now });
const task1 = randomUUID();
taskRepo.create({ task_id: task1, project_id: projectId, parent_task_id: storyId, sprint_id: sprintId, milestone: 'M1', item_type: 'task', description: 'Task done', status: 'done', priority: 'medium', created_at: now, updated_at: now });
const task2 = randomUUID();
taskRepo.create({ task_id: task2, project_id: projectId, parent_task_id: storyId, sprint_id: sprintId, milestone: 'M1', item_type: 'task', description: 'Task todo', status: 'todo', priority: 'low', created_at: now, updated_at: now }, [task1]);

const reportService = new ReportService(projectRepo, taskRepo, sprintRepo);
const manager = new ReportServerManager(reportService);

const info = await manager.start(0, '127.0.0.1');
assert(info.url.startsWith('http://127.0.0.1:'), 'server started with loopback url: ' + info.url);
assert(info.already_running === false, 'first start not already_running');

const info2 = await manager.start(0, '127.0.0.1');
assert(info2.already_running === true && info2.port === info.port, 'second start is idempotent');

const base = info.url.replace(/\/$/, '');

// GET /
const htmlRes = await fetch(base + '/');
assert(htmlRes.status === 200, 'GET / returns 200');
const html = await htmlRes.text();
assert(html.includes('Task Manager Report'), 'HTML contains title');
assert((htmlRes.headers.get('content-type') || '').includes('text/html'), 'HTML content-type');

// GET /api/projects
const projRes = await fetch(base + '/api/projects');
assert(projRes.status === 200, 'GET /api/projects returns 200');
const projects = await projRes.json();
assert(Array.isArray(projects) && projects.length === 1, 'one project returned');
const overview = projects[0];
assert(overview.counts.epics === 1 && overview.counts.stories === 1 && overview.counts.tasks === 2, 'counts correct: ' + JSON.stringify(overview.counts));
assert(overview.counts.sprints === 1 && overview.counts.milestones === 1, 'sprint/milestone counts correct');
assert(overview.progress.progress_percent === 50, 'project progress 50% (1/2 tasks done): ' + overview.progress.progress_percent);

// GET /api/projects/:id
const detailRes = await fetch(base + '/api/projects/' + projectId);
assert(detailRes.status === 200, 'GET /api/projects/:id returns 200');
const detail = await detailRes.json();
assert(detail.project.project_id === projectId, 'detail project id matches');
assert(detail.tree.length === 1 && detail.tree[0].item_type === 'epic', 'tree root is the epic');
assert(detail.tree[0].subtasks.length === 1, 'epic has 1 story child');
assert(detail.tree[0].subtasks[0].subtasks.length === 2, 'story has 2 task children');
assert(detail.tree[0].progress.progress_percent === 50, 'epic rollup progress 50%');
assert(detail.sprints.length === 1 && detail.sprints[0].progress.progress_percent === 50, 'sprint progress 50%');
assert(detail.milestones.length === 1 && detail.milestones[0].milestone === 'M1', 'milestone M1 present');
assert(detail.milestones[0].sprint_count === 1, 'milestone sprint_count 1');
// dependency captured
const todoTask = detail.tree[0].subtasks[0].subtasks.find(t => t.description === 'Task todo');
assert(todoTask.dependencies.length === 1 && todoTask.dependencies[0] === task1, 'dependency captured');

// GET /api/statuses
const statusRes = await fetch(base + '/api/statuses');
assert(statusRes.status === 200, 'GET /api/statuses 200');
const statuses = await statusRes.json();
assert(statuses.includes('todo') && statuses.includes('done'), 'statuses list ok');

// 404 for unknown project
const nf = await fetch(base + '/api/projects/' + randomUUID());
assert(nf.status === 404, 'unknown project -> 404');

// 405 for non-GET
const post = await fetch(base + '/api/projects', { method: 'POST' });
assert(post.status === 405, 'POST -> 405');

await manager.stop();
assert(manager.isRunning() === false, 'server stopped');

dbManager.closeDb();
console.log('\nALL SMOKE TESTS PASSED');
