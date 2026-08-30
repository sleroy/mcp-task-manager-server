import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs';
import path from 'node:path';

const stamp = Date.now();
const rootDir = process.cwd();
const databasePath = path.join(rootDir, 'data', `milestone-snapshot-smoke-${stamp}.db`);
const snapshotPath = path.join(rootDir, 'data', `milestone-snapshot-smoke-${stamp}.json`);

const transport = new StdioClientTransport({
  command: 'node',
  args: [path.join(rootDir, 'dist', 'server.js')],
  env: {
    ...process.env,
    DATABASE_PATH: databasePath,
    LOG_LEVEL: 'error',
  },
  stderr: 'pipe',
});

const client = new Client({ name: 'milestone-smoke', version: '1.0.0' });

const callTool = async (name, args) => {
  console.error(`calling ${name}`);
  const result = await client.callTool({ name, arguments: args });
  console.error(`completed ${name}`);
  return JSON.parse(result.content[0].text);
};

console.error('connecting');
try {
  await client.connect(transport);
} catch (error) {
  const stderr = transport.stderr;
  if (stderr) {
    stderr.setEncoding('utf8');
    stderr.on('data', chunk => process.stderr.write(chunk));
  }
  throw error;
}
console.error('connected');

const project = await callTool('createProject', { projectName: 'Milestone smoke' });
const projectId = project.project_id;
const sprint = await callTool('createSprint', {
  project_id: projectId,
  name: 'Sprint M0.1',
  description: 'Smoke sprint description',
  milestone: 'M0.1',
  status: 'active',
});
const epic = await callTool('createEpic', {
  project_id: projectId,
  description: 'Epic 1',
  milestone: 'M0.1',
});
const story = await callTool('createStory', {
  project_id: projectId,
  epic_id: epic.task_id,
  description: 'Story 1',
  milestone: 'M0.1',
});

await callTool('createWorkItemsBatch', {
  project_id: projectId,
  items: [
    {
      client_id: 't1',
      description: 'Task 1',
      parent_task_id: story.task_id,
      milestone: 'M0.1',
      priority: 'high',
    },
    {
      client_id: 't2',
      description: 'Task 2',
      parent_task_id: story.task_id,
      milestone: 'M0.1',
      dependency_client_ids: ['t1'],
    },
  ],
});

const assigned = await callTool('assignToSprint', {
  project_id: projectId,
  sprint_id: sprint.sprint_id,
  milestone: 'M0.1',
  item_type: 'task',
});
const nextTask = await callTool('getNextTask', { project_id: projectId });
const snapshot = await callTool('exportProjectSnapshot', {
  project_id: projectId,
  output_path: snapshotPath,
});
console.error('listing tools');
const tools = await client.listTools();
console.error('listed tools');

console.log(JSON.stringify({
  toolSmoke: true,
  toolCount: tools.tools.length,
  hasSnapshot: tools.tools.some(tool => tool.name === 'exportProjectSnapshot'),
  assigned_count: assigned.assigned_count,
  next_task: nextTask.description,
  snapshot_bytes: snapshot.bytes,
  snapshot_path: snapshot.output_path,
}));

await client.close();

for (const file of [databasePath, `${databasePath}-shm`, `${databasePath}-wal`, snapshotPath]) {
  try {
    fs.unlinkSync(file);
  } catch {
    // The sidecar files may not exist depending on SQLite journal state.
  }
}
