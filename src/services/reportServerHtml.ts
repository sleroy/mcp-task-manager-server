/**
 * The embedded single-page UI served by the report HTTP server.
 * It is a self-contained HTML document with inline CSS and vanilla JS that
 * talks to the JSON API exposed by ReportServerManager:
 *   GET /api/projects            -> ProjectOverview[]
 *   GET /api/projects/:id        -> ProjectDetail
 *   GET /api/statuses            -> TaskStatus[]
 * No external assets are loaded, so it works fully offline.
 */
export const REPORT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Task Manager Report</title>
<style>
  :root {
    --bg: #0f172a;
    --panel: #1e293b;
    --panel-2: #273449;
    --border: #334155;
    --text: #e2e8f0;
    --muted: #94a3b8;
    --accent: #38bdf8;
    --todo: #64748b;
    --in-progress: #f59e0b;
    --review: #a855f7;
    --done: #22c55e;
    --cancelled: #ef4444;
    --high: #ef4444;
    --medium: #f59e0b;
    --low: #64748b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
  }
  header {
    padding: 16px 24px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 16px;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  header h1 { font-size: 18px; margin: 0; }
  header .crumbs { color: var(--muted); font-size: 13px; }
  header .crumbs a { color: var(--accent); cursor: pointer; text-decoration: none; }
  header .crumbs a:hover { text-decoration: underline; }
  main { padding: 24px; max-width: 1100px; margin: 0 auto; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
  }
  .card.clickable { cursor: pointer; transition: border-color .15s, transform .15s; }
  .card.clickable:hover { border-color: var(--accent); transform: translateY(-2px); }
  .card h2 { margin: 0 0 4px; font-size: 16px; }
  .card .meta { color: var(--muted); font-size: 12px; margin-bottom: 12px; }
  .bar { height: 8px; background: var(--panel-2); border-radius: 999px; overflow: hidden; }
  .bar > span { display: block; height: 100%; background: var(--done); }
  .pct { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .counts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .pill {
    font-size: 11px; padding: 2px 8px; border-radius: 999px;
    background: var(--panel-2); color: var(--muted); border: 1px solid var(--border);
  }
  .section { margin-bottom: 28px; }
  .section > h3 { font-size: 14px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  .tabs { display: flex; gap: 4px; margin: 16px 0; flex-wrap: wrap; }
  .tab {
    padding: 6px 14px; border-radius: 8px; cursor: pointer;
    background: var(--panel); border: 1px solid var(--border); color: var(--muted);
  }
  .tab.active { color: var(--text); border-color: var(--accent); background: var(--panel-2); }
  .tree { list-style: none; margin: 0; padding: 0; }
  .tree ul { list-style: none; margin: 0; padding-left: 22px; border-left: 1px dashed var(--border); }
  .node { padding: 6px 0; }
  .node-row { display: flex; align-items: center; gap: 8px; }
  .toggle { width: 16px; text-align: center; cursor: pointer; color: var(--muted); user-select: none; }
  .toggle.leaf { visibility: hidden; }
  .badge { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: .04em; }
  .badge.epic { background: #7c3aed33; color: #c4b5fd; border: 1px solid #7c3aed66; }
  .badge.story { background: #2563eb33; color: #93c5fd; border: 1px solid #2563eb66; }
  .badge.task { background: #05966933; color: #6ee7b7; border: 1px solid #05966966; }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .status-todo { background: var(--todo); }
  .status-in-progress { background: var(--in-progress); }
  .status-review { background: var(--review); }
  .status-done { background: var(--done); }
  .status-cancelled { background: var(--cancelled); }
  .node .desc { flex: 1; }
  .node .desc.done, .node .desc.cancelled { color: var(--muted); text-decoration: line-through; }
  .node .prio { font-size: 10px; padding: 1px 6px; border-radius: 4px; }
  .prio-high { background: #ef444422; color: #fca5a5; }
  .prio-medium { background: #f59e0b22; color: #fcd34d; }
  .prio-low { background: #64748b22; color: #cbd5e1; }
  .node .mini { min-width: 90px; }
  .node .mini .bar { height: 5px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; }
  .status-tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; }
  .status-tag.planned { background: #64748b33; color: #cbd5e1; }
  .status-tag.active { background: #22c55e33; color: #86efac; }
  .status-tag.closed { background: #33415566; color: #94a3b8; }
  .status-tag.cancelled { background: #ef444433; color: #fca5a5; }
  .empty { color: var(--muted); font-style: italic; padding: 12px 0; }
  .loading { color: var(--muted); padding: 24px; text-align: center; }
  .breakdown { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; font-size: 11px; color: var(--muted); }
  .breakdown span b { color: var(--text); }
  .refresh { margin-left: auto; }
  button.btn {
    background: var(--panel-2); color: var(--text); border: 1px solid var(--border);
    padding: 6px 12px; border-radius: 8px; cursor: pointer;
  }
  button.btn:hover { border-color: var(--accent); }
  a.link { color: var(--accent); cursor: pointer; }
</style>
</head>
<body>
<header>
  <h1>Task Manager Report</h1>
  <div class="crumbs" id="crumbs"></div>
  <div class="refresh"><button class="btn" id="refreshBtn">Refresh</button></div>
</header>
<main id="app"><div class="loading">Loading…</div></main>
<script>
(function () {
  var app = document.getElementById('app');
  var crumbs = document.getElementById('crumbs');
  document.getElementById('refreshBtn').addEventListener('click', function () { route(); });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function api(path) {
    return fetch(path, { headers: { 'Accept': 'application/json' } }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    });
  }

  function bar(pct) {
    return '<div class="bar"><span style="width:' + (pct || 0) + '%"></span></div>' +
      '<div class="pct">' + (pct || 0) + '% complete</div>';
  }

  function breakdown(p) {
    var b = p.by_status || {};
    return '<div class="breakdown">' +
      '<span>Tasks: <b>' + p.total_tasks + '</b></span>' +
      '<span>Done: <b>' + p.done_tasks + '</b></span>' +
      '<span>Open: <b>' + p.open_tasks + '</b></span>' +
      '<span>To do: <b>' + (b.todo || 0) + '</b></span>' +
      '<span>In progress: <b>' + (b['in-progress'] || 0) + '</b></span>' +
      '<span>Review: <b>' + (b.review || 0) + '</b></span>' +
      '<span>Cancelled: <b>' + (b.cancelled || 0) + '</b></span>' +
      '</div>';
  }

  function setCrumbs(parts) {
    crumbs.innerHTML = parts.map(function (p, i) {
      if (i === parts.length - 1) { return esc(p.label); }
      return '<a data-hash="' + esc(p.hash) + '">' + esc(p.label) + '</a>';
    }).join(' &rsaquo; ');
    Array.prototype.forEach.call(crumbs.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function () { location.hash = a.getAttribute('data-hash'); });
    });
  }

  function renderProjects() {
    setCrumbs([{ label: 'Projects' }]);
    app.innerHTML = '<div class="loading">Loading projects…</div>';
    api('/api/projects').then(function (projects) {
      if (!projects.length) {
        app.innerHTML = '<div class="empty">No projects found.</div>';
        return;
      }
      var html = '<div class="grid">';
      projects.forEach(function (p) {
        var c = p.counts;
        html += '<div class="card clickable" data-id="' + esc(p.project_id) + '">' +
          '<h2>' + esc(p.name) + '</h2>' +
          '<div class="meta">Created ' + esc((p.created_at || '').slice(0, 10)) + '</div>' +
          bar(p.progress.progress_percent) +
          '<div class="counts">' +
            '<span class="pill">' + c.epics + ' epics</span>' +
            '<span class="pill">' + c.stories + ' stories</span>' +
            '<span class="pill">' + c.tasks + ' tasks</span>' +
            '<span class="pill">' + c.sprints + ' sprints</span>' +
            '<span class="pill">' + c.milestones + ' milestones</span>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
      app.innerHTML = html;
      Array.prototype.forEach.call(app.querySelectorAll('.card'), function (card) {
        card.addEventListener('click', function () {
          location.hash = '#/project/' + card.getAttribute('data-id');
        });
      });
    }).catch(function (e) {
      app.innerHTML = '<div class="empty">Failed to load projects: ' + esc(e.message) + '</div>';
    });
  }

  var STATUS_ORDER = ['todo', 'in-progress', 'review', 'done', 'cancelled'];

  function nodeHtml(node) {
    var hasKids = node.subtasks && node.subtasks.length;
    var descClass = (node.status === 'done' || node.status === 'cancelled') ? node.status : '';
    var html = '<li class="node">' +
      '<div class="node-row">' +
        '<span class="toggle' + (hasKids ? '' : ' leaf') + '">' + (hasKids ? '▾' : '') + '</span>' +
        '<span class="status-dot status-' + esc(node.status) + '" title="' + esc(node.status) + '"></span>' +
        '<span class="badge ' + esc(node.item_type) + '">' + esc(node.item_type) + '</span>' +
        '<span class="desc ' + descClass + '">' + esc(node.description) + '</span>' +
        '<span class="prio prio-' + esc(node.priority) + '">' + esc(node.priority) + '</span>';
    if (node.item_type !== 'task') {
      html += '<span class="mini">' + bar(node.progress.progress_percent) + '</span>';
    }
    html += '</div>';
    if (hasKids) {
      html += '<ul>' + node.subtasks.map(nodeHtml).join('') + '</ul>';
    }
    return html + '</li>';
  }

  function attachToggles(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.toggle'), function (t) {
      if (t.classList.contains('leaf')) { return; }
      t.addEventListener('click', function () {
        var ul = t.closest('.node').querySelector('ul');
        if (!ul) { return; }
        var hidden = ul.style.display === 'none';
        ul.style.display = hidden ? '' : 'none';
        t.textContent = hidden ? '▾' : '▸';
      });
    });
  }

  function renderDetail(projectId) {
    app.innerHTML = '<div class="loading">Loading project…</div>';
    api('/api/projects/' + encodeURIComponent(projectId)).then(function (d) {
      setCrumbs([{ label: 'Projects', hash: '#/' }, { label: d.project.name }]);
      var html = '';
      html += '<div class="section"><div class="card">' +
        '<h2>' + esc(d.project.name) + '</h2>' +
        '<div class="meta">Created ' + esc((d.project.created_at || '').slice(0, 10)) + ' &middot; ' + esc(d.project.project_id) + '</div>' +
        bar(d.progress.progress_percent) + breakdown(d.progress) +
      '</div></div>';

      html += '<div class="tabs">' +
        '<div class="tab active" data-tab="tree">Work items</div>' +
        '<div class="tab" data-tab="sprints">Sprints (' + d.sprints.length + ')</div>' +
        '<div class="tab" data-tab="milestones">Milestones (' + d.milestones.length + ')</div>' +
      '</div>';

      html += '<div class="tab-panel" id="panel-tree"></div>';
      html += '<div class="tab-panel" id="panel-sprints" style="display:none"></div>';
      html += '<div class="tab-panel" id="panel-milestones" style="display:none"></div>';
      app.innerHTML = html;

      // Tree panel
      var treePanel = document.getElementById('panel-tree');
      if (!d.tree.length) {
        treePanel.innerHTML = '<div class="empty">No work items yet.</div>';
      } else {
        treePanel.innerHTML = '<ul class="tree">' + d.tree.map(nodeHtml).join('') + '</ul>';
        attachToggles(treePanel);
      }

      // Sprints panel
      var sp = document.getElementById('panel-sprints');
      if (!d.sprints.length) {
        sp.innerHTML = '<div class="empty">No sprints defined.</div>';
      } else {
        var rows = d.sprints.map(function (s) {
          return '<tr>' +
            '<td>' + esc(s.name) + '</td>' +
            '<td><span class="status-tag ' + esc(s.status) + '">' + esc(s.status) + '</span></td>' +
            '<td>' + esc(s.milestone || '—') + '</td>' +
            '<td>' + esc(s.start_date || '—') + ' → ' + esc(s.end_date || '—') + '</td>' +
            '<td style="min-width:140px">' + bar(s.progress.progress_percent) + '</td>' +
            '<td>' + s.progress.done_tasks + '/' + s.progress.total_tasks + '</td>' +
          '</tr>';
        }).join('');
        sp.innerHTML = '<table><thead><tr><th>Name</th><th>Status</th><th>Milestone</th><th>Dates</th><th>Progress</th><th>Tasks</th></tr></thead><tbody>' + rows + '</tbody></table>';
      }

      // Milestones panel
      var mp = document.getElementById('panel-milestones');
      if (!d.milestones.length) {
        mp.innerHTML = '<div class="empty">No milestones tagged.</div>';
      } else {
        var mrows = d.milestones.map(function (m) {
          return '<tr>' +
            '<td>' + esc(m.milestone) + '</td>' +
            '<td>' + m.sprint_count + '</td>' +
            '<td style="min-width:140px">' + bar(m.progress.progress_percent) + '</td>' +
            '<td>' + m.progress.done_tasks + '/' + m.progress.total_tasks + '</td>' +
          '</tr>';
        }).join('');
        mp.innerHTML = '<table><thead><tr><th>Milestone</th><th>Sprints</th><th>Progress</th><th>Tasks</th></tr></thead><tbody>' + mrows + '</tbody></table>';
      }

      Array.prototype.forEach.call(app.querySelectorAll('.tab'), function (tab) {
        tab.addEventListener('click', function () {
          Array.prototype.forEach.call(app.querySelectorAll('.tab'), function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          ['tree', 'sprints', 'milestones'].forEach(function (name) {
            document.getElementById('panel-' + name).style.display = (name === tab.getAttribute('data-tab')) ? '' : 'none';
          });
        });
      });
    }).catch(function (e) {
      app.innerHTML = '<div class="empty">Failed to load project: ' + esc(e.message) + '</div>';
    });
  }

  function route() {
    var hash = location.hash || '#/';
    var m = hash.match(/^#\\/project\\/(.+)$/);
    if (m) { renderDetail(decodeURIComponent(m[1])); }
    else { renderProjects(); }
  }

  window.addEventListener('hashchange', route);
  route();
})();
</script>
</body>
</html>`;
