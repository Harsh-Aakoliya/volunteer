// controllers/monitoringController.js – Login Monitoring dashboard (API + HTML)
import tokenStore from "../services/tokenStore.js";

const monitoringController = {
  // ─── JSON API: all sessions ─────────────────────────────────────────────
  async getSessions(req, res) {
    try {
      const sessions = await tokenStore.getAllSessions();
      res.json({ success: true, sessions });
    } catch (err) {
      console.error("monitoring getSessions error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  // ─── JSON API: active sessions only ─────────────────────────────────────
  async getActiveSessions(req, res) {
    try {
      const sessions = await tokenStore.getActiveSessions();
      res.json({ success: true, sessions });
    } catch (err) {
      console.error("monitoring getActiveSessions error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  // ─── JSON API: remote logout a user ─────────────────────────────────────
  async remoteLogout(req, res) {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: "userId required" });
      const count = await tokenStore.invalidateAllForUser(userId, "remote");
      res.json({ success: true, message: `Revoked ${count} session(s)` });
    } catch (err) {
      console.error("monitoring remoteLogout error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  // ─── HTML Dashboard ─────────────────────────────────────────────────────
  dashboard(req, res) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(DASHBOARD_HTML);
  },
};

// ─── Single-file HTML / CSS / JS dashboard ────────────────────────────────
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Login Monitoring</title>
<style>
  :root { --bg: #0f172a; --card: #1e293b; --border: #334155; --accent: #38bdf8; --green: #22c55e; --red: #ef4444; --yellow: #eab308; --text: #e2e8f0; --muted: #94a3b8; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  .header { background: var(--card); border-bottom: 1px solid var(--border); padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; position: sticky; top: 0; z-index: 10; }
  .header h1 { font-size: 20px; font-weight: 700; } .header h1 span { color: var(--accent); }
  .stats { display: flex; gap: 24px; }
  .stat { text-align: center; } .stat .num { font-size: 22px; font-weight: 700; } .stat .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
  .controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .btn { padding: 7px 14px; border: 1px solid var(--border); border-radius: 6px; background: var(--card); color: var(--text); cursor: pointer; font-size: 13px; transition: .15s; }
  .btn:hover { border-color: var(--accent); color: var(--accent); }
  .btn.active { background: var(--accent); color: var(--bg); border-color: var(--accent); font-weight: 600; }
  .btn.danger { border-color: var(--red); color: var(--red); } .btn.danger:hover { background: var(--red); color: #fff; }
  .search-box { padding: 7px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 13px; width: 200px; }
  .search-box::placeholder { color: var(--muted); }
  .container { padding: 16px 24px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); background: var(--card); border-bottom: 1px solid var(--border); position: sticky; top: 68px; z-index: 5; }
  td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
  tr:hover td { background: rgba(56,189,248,.04); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .badge-active { background: rgba(34,197,94,.15); color: var(--green); }
  .badge-inactive { background: rgba(239,68,68,.12); color: var(--red); }
  .badge-self { background: rgba(148,163,184,.15); color: var(--muted); }
  .badge-remote { background: rgba(234,179,8,.15); color: var(--yellow); }
  .badge-expired { background: rgba(148,163,184,.1); color: #64748b; }
  .user-cell { display: flex; flex-direction: column; gap: 1px; } .user-cell .name { font-weight: 600; } .user-cell .mobile { font-size: 12px; color: var(--muted); }
  .time { font-size: 12px; color: var(--muted); white-space: nowrap; }
  .device { max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; color: var(--muted); }
  .logout-btn { padding: 4px 10px; border: 1px solid var(--red); border-radius: 4px; background: transparent; color: var(--red); cursor: pointer; font-size: 12px; font-weight: 600; transition: .15s; }
  .logout-btn:hover { background: var(--red); color: #fff; }
  .logout-btn:disabled { opacity: .4; cursor: not-allowed; }
  .empty { text-align: center; padding: 60px 20px; color: var(--muted); }
  .loader { display: inline-block; width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .toast { position: fixed; bottom: 24px; right: 24px; background: var(--card); border: 1px solid var(--border); padding: 12px 20px; border-radius: 8px; font-size: 13px; z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,.4); transition: opacity .3s; }
  .toast.success { border-color: var(--green); } .toast.error { border-color: var(--red); }
</style>
</head>
<body>

<div class="header">
  <h1><span>&#x1F6E1;</span> Login Monitoring</h1>
  <div class="stats" id="stats">
    <div class="stat"><div class="num" id="totalCount">-</div><div class="label">Total</div></div>
    <div class="stat"><div class="num" id="activeCount" style="color:var(--green)">-</div><div class="label">Active</div></div>
    <div class="stat"><div class="num" id="inactiveCount" style="color:var(--red)">-</div><div class="label">Logged Out</div></div>
  </div>
  <div class="controls">
    <input type="text" class="search-box" id="search" placeholder="Search name or mobile..." />
    <button class="btn active" id="btnAll" onclick="setFilter('all')">All</button>
    <button class="btn" id="btnActive" onclick="setFilter('active')">Active</button>
    <button class="btn" id="btnInactive" onclick="setFilter('inactive')">Logged Out</button>
    <button class="btn" onclick="fetchData()">&#x21bb; Refresh</button>
  </div>
</div>

<div class="container">
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>User</th>
        <th>Status</th>
        <th>Logged In</th>
        <th>Logged Out</th>
        <th>Reason</th>
        <th>Device / IP</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>
  <div class="empty" id="empty" style="display:none">No sessions found</div>
</div>

<script>
let allSessions = [];
let filter = 'all';
let searchTerm = '';
const BASE = window.location.origin;

document.getElementById('search').addEventListener('input', e => { searchTerm = e.target.value.toLowerCase(); render(); });

function setFilter(f) {
  filter = f;
  document.querySelectorAll('.controls .btn').forEach(b => b.classList.remove('active'));
  document.getElementById(f === 'all' ? 'btnAll' : f === 'active' ? 'btnActive' : 'btnInactive').classList.add('active');
  render();
}

function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  const pad = n => String(n).padStart(2, '0');
  return dt.getFullYear() + '-' + pad(dt.getMonth()+1) + '-' + pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
}

function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

function render() {
  let data = allSessions;
  if (filter === 'active') data = data.filter(s => s.is_active);
  else if (filter === 'inactive') data = data.filter(s => !s.is_active);
  if (searchTerm) data = data.filter(s => (s.user_name||'').toLowerCase().includes(searchTerm) || (s.mobile_number||'').includes(searchTerm) || (s.user_id||'').includes(searchTerm));

  const tbody = document.getElementById('tbody');
  const empty = document.getElementById('empty');
  if (data.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = data.map((s, i) => {
    const statusBadge = s.is_active
      ? '<span class="badge badge-active">Active</span>'
      : '<span class="badge badge-inactive">Logged Out</span>';
    const reasonBadge = !s.is_active && s.logout_reason
      ? '<span class="badge badge-' + s.logout_reason + '">' + s.logout_reason + '</span>'
      : '-';
    const deviceStr = [s.ip_address, (s.device_info||'').substring(0,50)].filter(Boolean).join(' · ') || '-';
    const actionBtn = s.is_active
      ? '<button class="logout-btn" onclick="remoteLogout(\\'' + s.user_id + '\\')">Remote Logout</button>'
      : '';
    return '<tr>' +
      '<td>' + (i+1) + '</td>' +
      '<td><div class="user-cell"><span class="name">' + (s.user_name || s.user_id) + '</span><span class="mobile">' + (s.mobile_number||'') + ' · ID ' + s.user_id + '</span></div></td>' +
      '<td>' + statusBadge + '</td>' +
      '<td><div class="time">' + fmtDate(s.logged_in_at) + '</div><div class="time">' + timeAgo(s.logged_in_at) + '</div></td>' +
      '<td><div class="time">' + fmtDate(s.logged_out_at) + '</div></td>' +
      '<td>' + reasonBadge + '</td>' +
      '<td><div class="device" title="' + deviceStr + '">' + deviceStr + '</div></td>' +
      '<td>' + actionBtn + '</td>' +
      '</tr>';
  }).join('');

  document.getElementById('totalCount').textContent = allSessions.length;
  document.getElementById('activeCount').textContent = allSessions.filter(s => s.is_active).length;
  document.getElementById('inactiveCount').textContent = allSessions.filter(s => !s.is_active).length;
}

async function fetchData() {
  try {
    const r = await fetch(BASE + '/api/monitoring/sessions');
    const d = await r.json();
    if (d.success) { allSessions = d.sessions; render(); }
  } catch (e) { console.error(e); }
}

async function remoteLogout(userId) {
  if (!confirm('Remote logout all sessions for user ' + userId + '?')) return;
  try {
    const r = await fetch(BASE + '/api/monitoring/remote-logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const d = await r.json();
    showToast(d.message, d.success ? 'success' : 'error');
    fetchData();
  } catch (e) {
    showToast('Failed to logout user', 'error');
  }
}

function showToast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 3000);
}

fetchData();
setInterval(fetchData, 15000);
</script>
</body>
</html>`;

export default monitoringController;
