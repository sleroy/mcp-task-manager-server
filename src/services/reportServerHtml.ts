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
  .filters { display: flex; align-items: center; gap: 8px; margin: 4px 0 14px; flex-wrap: wrap; }
  .filters .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
  .chip {
    padding: 4px 12px; border-radius: 999px; cursor: pointer; font-size: 12px;
    background: var(--panel); border: 1px solid var(--border); color: var(--muted);
    user-select: none;
  }
  .chip.active { color: var(--text); border-color: var(--accent); background: var(--panel-2); }
  .filter-count { color: var(--muted); font-size: 12px; margin-left: auto; }
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
  .node .desc .md-inline code, .md code {
    background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 4px; padding: 0 4px; font-size: 12px;
  }
  .desc-toggle { cursor: pointer; color: var(--accent); font-size: 11px; user-select: none; margin-left: 6px; }
  .md {
    margin: 6px 0 2px 24px; padding: 10px 12px; background: var(--panel-2);
    border: 1px solid var(--border); border-radius: 8px; font-size: 13px; line-height: 1.5;
    max-width: 900px;
  }
  .md p { margin: 0 0 8px; }
  .md p:last-child { margin-bottom: 0; }
  .md h1, .md h2, .md h3 { margin: 8px 0 4px; font-size: 14px; }
  .md ul, .md ol { margin: 4px 0 8px; padding-left: 20px; }
  .md li { margin: 2px 0; }
  .md pre {
    background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
    padding: 8px 10px; overflow-x: auto; margin: 6px 0;
  }
  .md pre code { background: none; border: none; padding: 0; }
  .md a { color: var(--accent); }
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

  // Minimal, dependency-free Markdown renderer. Everything is HTML-escaped
  // first, then a small set of inline/block constructs are re-introduced, so
  // it is safe against injection from task descriptions.
  var NL = String.fromCharCode(10);
  var BT = String.fromCharCode(96);
  var RE_INLINE_CODE = new RegExp(BT + '([^' + BT + ']+)' + BT, 'g');
  var RE_FENCE_OPEN = new RegExp('^\\s*' + BT + BT + BT + '(.*)$');
  var RE_FENCE_CLOSE = new RegExp('^\\s*' + BT + BT + BT + '\\s*$');
  var RE_FENCE_ANY = new RegExp('^\\s*' + BT + BT + BT);
  function mdInlineFromEscaped(escaped) {
    return escaped
      // inline code
      .replace(RE_INLINE_CODE, '<code>$1</code>')
      // bold
      .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      // italic
      .replace(/(^|[^*])\\*([^*]+)\\*/g, '$1<em>$2</em>')
      // links [text](url) - only http/https/mailto
      .replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+|mailto:[^\\s)]+)\\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  // Render the first non-empty line of a description as inline markdown, for
  // use as a compact row label.
  function mdInlineFirstLine(text) {
    var firstLine = String(text == null ? '' : text).split(/\\r?\\n/)[0];
    return '<span class="md-inline">' + mdInlineFromEscaped(esc(firstLine)) + '</span>';
  }

  // Render a full markdown block (headings, lists, fenced code, paragraphs).
  function mdBlock(text) {
    var src = String(text == null ? '' : text);
    var lines = src.split(/\\r?\\n/);
    var out = [];
    var i = 0;
    var listType = null; // 'ul' | 'ol'
    function closeList() { if (listType) { out.push('</' + listType + '>'); listType = null; } }
    while (i < lines.length) {
      var line = lines[i];
      // fenced code block
      var fence = line.match(RE_FENCE_OPEN);
      if (fence) {
        closeList();
        var code = [];
        i++;
        while (i < lines.length && !RE_FENCE_CLOSE.test(lines[i])) { code.push(lines[i]); i++; }
        i++; // skip closing fence
        out.push('<pre><code>' + esc(code.join(NL)) + '</code></pre>');
        continue;
      }
      var heading = line.match(/^(#{1,3})\\s+(.*)$/);
      if (heading) {
        closeList();
        var level = heading[1].length;
        out.push('<h' + level + '>' + mdInlineFromEscaped(esc(heading[2])) + '</h' + level + '>');
        i++;
        continue;
      }
      var ol = line.match(/^\\s*\\d+\\.\\s+(.*)$/);
      var ul = line.match(/^\\s*[-*+]\\s+(.*)$/);
      if (ol || ul) {
        var wanted = ol ? 'ol' : 'ul';
        if (listType !== wanted) { closeList(); out.push('<' + wanted + '>'); listType = wanted; }
        out.push('<li>' + mdInlineFromEscaped(esc((ol || ul)[1])) + '</li>');
        i++;
        continue;
      }
      if (/^\\s*$/.test(line)) { closeList(); i++; continue; }
      // paragraph: gather consecutive non-empty, non-special lines
      closeList();
      var para = [line];
      i++;
      while (i < lines.length && !/^\\s*$/.test(lines[i]) &&
             !RE_FENCE_ANY.test(lines[i]) && !/^#{1,3}\\s/.test(lines[i]) &&
             !/^\\s*\\d+\\.\\s/.test(lines[i]) && !/^\\s*[-*+]\\s/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      out.push('<p>' + mdInlineFromEscaped(esc(para.join(NL))).split(NL).join('<br>') + '</p>');
    }
    closeList();
    return out.join('');
  }

  // True when a description has more than one line (worth an expandable block).
  function hasRichDescription(text) {
    return /\\r?\\n/.test(String(text == null ? '' : text).trim());
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
  var OPEN_STATUSES = ['todo', 'in-progress', 'review'];
  var CLOSED_STATUSES = ['done', 'cancelled'];

  // Map a filter key to the concrete set of statuses it accepts.
  function statusesForFilter(key) {
    if (key === 'all') { return STATUS_ORDER; }
    if (key === 'open') { return OPEN_STATUSES; }
    if (key === 'closed') { return CLOSED_STATUSES; }
    return [key];
  }

  // Prune a work-item tree to nodes whose status is in the allowed set.
  // A parent is kept if it matches OR any descendant matches, so hierarchy
  // and context are preserved.
  function filterTree(nodes, allowed) {
    var out = [];
    nodes.forEach(function (node) {
      var kids = (node.subtasks && node.subtasks.length)
        ? filterTree(node.subtasks, allowed)
        : [];
      var selfMatch = allowed.indexOf(node.status) !== -1;
      if (selfMatch || kids.length) {
        var copy = Object.assign({}, node);
        copy.subtasks = kids;
        out.push(copy);
      }
    });
    return out;
  }

  // Count leaf/all nodes in a tree for the filter summary.
  function countNodes(nodes) {
    var n = 0;
    nodes.forEach(function (node) {
      n += 1;
      if (node.subtasks && node.subtasks.length) { n += countNodes(node.subtasks); }
    });
    return n;
  }

  function nodeHtml(node) {
    var hasKids = node.subtasks && node.subtasks.length;
    var descClass = (node.status === 'done' || node.status === 'cancelled') ? node.status : '';
    var rich = hasRichDescription(node.description);
    var html = '<li class="node">' +
      '<div class="node-row">' +
        '<span class="toggle' + (hasKids ? '' : ' leaf') + '">' + (hasKids ? '▾' : '') + '</span>' +
        '<span class="status-dot status-' + esc(node.status) + '" title="' + esc(node.status) + '"></span>' +
        '<span class="badge ' + esc(node.item_type) + '">' + esc(node.item_type) + '</span>' +
        '<span class="desc ' + descClass + '">' + mdInlineFirstLine(node.description) +
          (rich ? '<span class="desc-toggle" data-desc-toggle>▸ details</span>' : '') +
        '</span>' +
        '<span class="prio prio-' + esc(node.priority) + '">' + esc(node.priority) + '</span>';
    if (node.item_type !== 'task') {
      html += '<span class="mini">' + bar(node.progress.progress_percent) + '</span>';
    }
    html += '</div>';
    if (rich) {
      html += '<div class="md" data-desc-body style="display:none">' + mdBlock(node.description) + '</div>';
    }
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
    // Expand/collapse full markdown descriptions.
    Array.prototype.forEach.call(root.querySelectorAll('[data-desc-toggle]'), function (tg) {
      tg.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var node = tg.closest('.node');
        var body = node && node.querySelector('[data-desc-body]');
        if (!body) { return; }
        var hidden = body.style.display === 'none';
        body.style.display = hidden ? '' : 'none';
        tg.textContent = (hidden ? '▾' : '▸') + ' details';
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

      // Tree panel with status filter (open/closed/all + per-status).
      var treePanel = document.getElementById('panel-tree');
      var fullTree = d.tree || [];
      var currentFilter = 'open';

      var FILTER_CHIPS = [
        { key: 'all', label: 'All' },
        { key: 'open', label: 'Open' },
        { key: 'closed', label: 'Closed' },
        { key: 'todo', label: 'To do' },
        { key: 'in-progress', label: 'In progress' },
        { key: 'review', label: 'Review' },
        { key: 'done', label: 'Done' },
        { key: 'cancelled', label: 'Cancelled' }
      ];

      function renderTree() {
        var allowed = statusesForFilter(currentFilter);
        var filtered = filterTree(fullTree, allowed);
        var chipsHtml = FILTER_CHIPS.map(function (c) {
          return '<span class="chip' + (c.key === currentFilter ? ' active' : '') +
            '" data-filter="' + c.key + '">' + esc(c.label) + '</span>';
        }).join('');
        var html = '<div class="filters"><span class="label">Status</span>' + chipsHtml +
          '<span class="filter-count">' + countNodes(filtered) + ' of ' + countNodes(fullTree) + ' items</span></div>';
        if (!fullTree.length) {
          html += '<div class="empty">No work items yet.</div>';
        } else if (!filtered.length) {
          html += '<div class="empty">No work items match this filter.</div>';
        } else {
          html += '<ul class="tree">' + filtered.map(nodeHtml).join('') + '</ul>';
        }
        treePanel.innerHTML = html;
        attachToggles(treePanel);
        Array.prototype.forEach.call(treePanel.querySelectorAll('.chip'), function (chip) {
          chip.addEventListener('click', function () {
            currentFilter = chip.getAttribute('data-filter');
            renderTree();
          });
        });
      }

      renderTree();

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

      // Milestones panel. Each row is clickable to reveal the work items tagged
      // with that milestone (collected from the full work-item tree).
      var mp = document.getElementById('panel-milestones');
      if (!d.milestones.length) {
        mp.innerHTML = '<div class="empty">No milestones tagged.</div>';
      } else {
        // Flatten the tree once so we can gather items per milestone.
        function flatten(nodes, acc) {
          nodes.forEach(function (node) {
            acc.push(node);
            if (node.subtasks && node.subtasks.length) { flatten(node.subtasks, acc); }
          });
          return acc;
        }
        var allNodes = flatten(fullTree, []);
        var mrows = d.milestones.map(function (m, idx) {
          var items = allNodes.filter(function (n) { return n.milestone === m.milestone; });
          var itemsHtml = items.length
            ? '<ul class="tree">' + items.map(function (n) {
                // Render each associated item as a standalone (childless) node
                // so the milestone view is a flat, focused list.
                return nodeHtml(Object.assign({}, n, { subtasks: [] }));
              }).join('') + '</ul>'
            : '<div class="empty">No work items tagged with this milestone.</div>';
          return '<tr class="ms-row" data-ms="' + idx + '" style="cursor:pointer">' +
              '<td>▸ ' + esc(m.milestone) + '</td>' +
              '<td>' + m.sprint_count + '</td>' +
              '<td style="min-width:140px">' + bar(m.progress.progress_percent) + '</td>' +
              '<td>' + m.progress.done_tasks + '/' + m.progress.total_tasks + '</td>' +
            '</tr>' +
            '<tr class="ms-detail" data-ms-detail="' + idx + '" style="display:none">' +
              '<td colspan="4">' + itemsHtml + '</td>' +
            '</tr>';
        }).join('');
        mp.innerHTML = '<table><thead><tr><th>Milestone</th><th>Sprints</th><th>Progress</th><th>Tasks</th></tr></thead><tbody>' + mrows + '</tbody></table>';
        attachToggles(mp);
        Array.prototype.forEach.call(mp.querySelectorAll('.ms-row'), function (row) {
          row.addEventListener('click', function () {
            var idx = row.getAttribute('data-ms');
            var detail = mp.querySelector('[data-ms-detail="' + idx + '"]');
            if (!detail) { return; }
            var hidden = detail.style.display === 'none';
            detail.style.display = hidden ? '' : 'none';
            var cell = row.querySelector('td');
            cell.textContent = (hidden ? '▾ ' : '▸ ') + cell.textContent.slice(2);
          });
        });
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
