const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let me = null, chat = [], F = { q: '', s: '' }, timer;
const tok = () => localStorage.getItem('token');
const staff = () => me && me.role !== 'user';
const badge = s => `<span class="b ${String(s).replace(/\s/g, '')}">${esc(s)}</span>`;
const fmt = d => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
function toast(m) { const t = $('#toast'); t.textContent = m; t.className = 's'; setTimeout(() => t.className = '', 2500); }
async function api(p, o = {}) {
  const r = await fetch('/api' + p, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok() }, body: o.body ? JSON.stringify(o.body) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Request failed'); return j;
}
const kpi = (a, b) => `<div class="card kpi"><span>${a}</span><b>${b}</b></div>`;
const bars = o => { const m = Math.max(1, ...Object.values(o)); return Object.entries(o).map(([k, v]) => `<div class="row"><span style="width:130px">${esc(k)}</span><div class="bar" style="flex:1;align-self:center"><i style="width:${v / m * 100}%"></i></div><b>${v}</b></div>`).join(''); };
function donut(o) { const t = Object.values(o).reduce((a, b) => a + b, 0) || 1, C = ['#4f46e5', '#f59e0b', '#22c55e', '#ef4444', '#06b6d4', '#a855f7', '#64748b']; let off = 0;
  const s = Object.entries(o).map(([k, v], i) => { const p = v / t * 100, c = `<circle cx="18" cy="18" r="15.9" fill="none" stroke="${C[i % 7]}" stroke-width="5" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${-off}" transform="rotate(-90 18 18)"/>`; off += p; return c; }).join('');
  return `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 36 36" width="130">${s}</svg><div>${Object.entries(o).map(([k, v], i) => `<div><span style="color:${C[i % 7]}">●</span> ${esc(k)} (${v})</div>`).join('')}</div></div>`; }
const table = ts => `<div class="tw"><table><tr><th>ID</th><th>Title</th><th>Category</th><th>Priority</th><th>Agent</th><th>Status</th><th>Updated</th></tr>${ts.map(t => `<tr class="k" onclick="location.hash='#/ticket/${t.id}'"><td><b>${t.id}</b></td><td>${esc(t.title)}</td><td>${esc(t.category)}</td><td>${badge(t.priority)}</td><td>${esc(t.agent)}</td><td>${badge(t.status)}</td><td>${fmt(t.updated)}</td></tr>`).join('') || '<tr><td colspan="7">No tickets found.</td></tr>'}</table></div>`;

// ---------- auth ----------
function authPage(reg) {
  $('#app').innerHTML = `<div class="auth"><div class="card"><div class="logo"><i>✦</i>TechAssist AI</div><div class="tag">Smarter Support. Faster Resolution.</div><h2>${reg ? 'Create account' : 'Welcome back'}</h2>
  ${reg ? '<label>Full name</label><input id="n">' : ''}<label>Email</label><input id="e" type="email"><label>Password</label><input id="p" type="password" onkeydown="if(event.key==='Enter')doAuth(${!!reg})">
  <br><br><button style="width:100%" onclick="doAuth(${!!reg})">${reg ? 'Register' : 'Log in'}</button>
  <p>${reg ? 'Have an account? <a href="#" onclick="authPage();return false" style="color:var(--pr)">Log in</a>' : 'New? <a href="#" onclick="authPage(true);return false" style="color:var(--pr)">Create account</a>'}</p>
  ${reg ? '' : '<small style="color:var(--mu)">Demo: user@demo.com / user123 · agent@demo.com / agent123 · admin@demo.com / admin123</small>'}</div></div>`;
}
async function doAuth(reg) {
  try { const r = await api(reg ? '/auth/register' : '/auth/login', { method: 'POST', body: { name: $('#n') && $('#n').value, email: $('#e').value, password: $('#p').value } });
    localStorage.setItem('token', r.token); me = r.user; location.hash = '#/dashboard'; route(); } catch (e) { toast(e.message); }
}
const logout = () => { localStorage.removeItem('token'); me = null; authPage(); };

// ---------- layout ----------
function shell(html, p) {
  const nav = [['dashboard', 'Dashboard'], ['tickets', staff() ? 'Ticket Queue' : 'My Complaints'], ['new', 'Create Complaint'], ['chat', 'AI Support Chat'], ['kb', 'Knowledge Base']];
  if (me.role === 'admin') nav.push(['users', 'User Management']);
  return `<div class="app"><aside class="side"><div class="logo"><i>✦</i>TechAssist AI</div><div class="tag">Smarter Support. Faster Resolution.</div>${nav.map(n => `<a class="n ${p === n[0] || (p === 'ticket' && n[0] === 'tickets') ? 'on' : ''}" href="#/${n[0]}">${n[1]}</a>`).join('')}</aside>
  <div class="main"><header class="top"><span>${esc(me.name)} · ${badge(me.role)}</span><span><a class="btn" href="#/new">+ New</a> <button class="o" onclick="logout()">Logout</button></span></header><main class="pg">${html}</main></div></div>`;
}

// ---------- pages ----------
const pages = {
  async dashboard() {
    const [s, ts] = await Promise.all([api('/stats'), api('/tickets')]);
    return `<h1>Welcome, ${esc(me.name.split(' ')[0])} 👋</h1><div class="grid g4">${kpi('Total', s.total)}${kpi('Open', s.open)}${kpi('Resolved', s.resolved)}${kpi('Escalated', s.escalated)}${kpi('SLA compliance', s.slaCompliance)}${kpi('Avg response', s.avgResponse)}${kpi('AI resolved', s.aiResolved)}</div>
    <div class="grid g2"><div class="card"><h2>Status distribution</h2>${donut(s.byStatus)}</div><div class="card"><h2>By category</h2>${bars(s.byCategory)}</div><div class="card"><h2>By priority</h2>${bars(s.byPriority)}</div></div>
    <div class="card"><h2>Recent tickets</h2>${table(ts.slice(0, 5))}</div>`;
  },
  async tickets() {
    const ts = await api(`/tickets?q=${encodeURIComponent(F.q)}&status=${encodeURIComponent(F.s)}`);
    return `<h1>${staff() ? 'Ticket Queue' : 'My Complaints'}</h1><div class="tabs">${['', 'New', 'Assigned', 'In Progress', 'Waiting for User', 'Escalated', 'Resolved', 'Closed'].map(s => `<button class="${F.s === s ? 'on' : ''}" onclick="F.s='${s}';route()">${s || 'All'}</button>`).join('')}</div>
    <input style="max-width:320px;margin-bottom:12px" placeholder="Search tickets…" value="${esc(F.q)}" oninput="clearTimeout(timer);timer=setTimeout(()=>{F.q=this.value;reloadTable()},300)"><div class="card" id="tb">${table(ts)}</div>`;
  },
  async new() {
    return `<h1>Create Complaint</h1><div class="grid g2"><div class="card"><label>Title</label><input id="t"><label>Description</label><textarea id="d" rows="6" oninput="clearTimeout(timer);timer=setTimeout(analyzeNow,500)" placeholder="Describe the problem…"></textarea><label>Priority (optional override)</label><select id="pr"><option value="">Let AI decide</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select><br><br><button onclick="submitT()">Submit complaint</button></div>
    <div class="ai" id="aip"><b>✦ AI Assist</b><p>Describe your issue and the AI will analyze it live.</p></div></div>`;
  },
  async ticket(id) {
    const t = await api('/tickets/' + id);
    return `<a href="#/tickets" style="color:var(--pr)">← Back</a><h1 style="margin-top:8px">${t.id} · ${esc(t.title)}</h1><p>${badge(t.priority)} ${badge(t.status)}</p>${t.duplicateOf ? `<div class="ai">⚠ Possible duplicate of ${t.duplicateOf}</div><br>` : ''}
    <div class="grid g2"><div class="card"><h2>Details</h2><p>${esc(t.description)}</p><div class="row"><span>Category</span>${esc(t.category)}</div><div class="row"><span>Requester</span>${esc(t.requester)}</div><div class="row"><span>Agent</span>${esc(t.agent)}</div><div class="row"><span>Sentiment</span>${esc(t.sentiment)}</div><div class="row"><span>Created</span>${fmt(t.created)}</div>
    ${staff() ? `<label>Change status</label><select onchange="setT('${t.id}',{status:this.value})">${['New', 'Assigned', 'In Progress', 'Waiting for User', 'Escalated', 'Resolved', 'Closed'].map(s => `<option ${s === t.status ? 'selected' : ''}>${s}</option>`).join('')}</select><label>Change priority</label><select onchange="setT('${t.id}',{priority:this.value})">${['Low', 'Medium', 'High', 'Critical'].map(s => `<option ${s === t.priority ? 'selected' : ''}>${s}</option>`).join('')}</select>` : ''}</div>
    <div class="card"><h2>Conversation</h2>${t.comments.map(c => `<div class="bub ${c.role === 'user' ? 'me' : c.internal ? 'note' : 'bot'}"><small>${esc(c.by)}${c.internal ? ' · internal note' : ''} · ${fmt(c.at)}</small><br>${esc(c.text)}</div>`).join('')}
    <textarea id="rp" rows="3" placeholder="Write a reply…"></textarea>${staff() ? '<label><input type="checkbox" id="in" style="width:auto"> Internal note (hidden from user)</label>' : ''}<br><button onclick="reply('${t.id}')">Send</button></div></div>`;
  },
  async chat() {
    return `<h1>AI Support Chat</h1><div class="card"><div id="ch" style="min-height:260px;max-height:55vh;overflow:auto"><div class="bub bot">Hi! I am TechAssist AI. Describe your issue.</div>${chat.map(m => `<div class="bub ${m.me ? 'me' : 'bot'}">${esc(m.t)}</div>`).join('')}</div>
    <div class="tabs" style="margin-top:8px">${['Wi-Fi not connecting', 'Printer not working', 'I forgot my password', 'Laptop is overheating'].map(s => `<button onclick="say('${s}')">${s}</button>`).join('')}</div>
    <div style="display:flex;gap:8px"><input id="ci" placeholder="Type a message…" onkeydown="if(event.key==='Enter')say()"><button onclick="say()">Send</button></div>
    <p><button class="o" onclick="location.hash='#/new'">Create Ticket</button> <button class="o" onclick="toast('Escalated to a human agent')">Escalate to Human</button> <button class="o" onclick="chat=[];toast('Marked as solved');route()">Mark as Solved</button></p></div>`;
  },
  async kb() {
    const a = await api('/kb?q=' + encodeURIComponent(F.k || ''));
    return `<h1>Knowledge Base</h1><input placeholder="Search for technical solutions…" value="${esc(F.k || '')}" oninput="clearTimeout(timer);timer=setTimeout(()=>{F.k=this.value;route()},300)" style="margin-bottom:16px"><div class="grid g2">${a.map(x => `<div class="card"><span class="b">${esc(x.category)}</span><h2 style="margin-top:8px">${esc(x.title)}</h2><p style="color:var(--mu)">${esc(x.summary)}</p><small>👁 ${x.views} views</small></div>`).join('') || '<div class="card">No articles found.</div>'}</div>`;
  },
  async users() {
    if (me.role !== 'admin') return '<div class="card">Admins only.</div>';
    const u = await api('/users');
    return `<h1>User Management</h1><div class="card tw"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Dept</th><th>Status</th><th>Action</th></tr>${u.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td><td><select onchange="setU(${x.id},{role:this.value})">${['user', 'agent', 'admin'].map(r => `<option ${r === x.role ? 'selected' : ''}>${r}</option>`).join('')}</select></td><td>${esc(x.dept)}</td><td>${x.active ? 'Active' : 'Suspended'}</td><td><button class="o" onclick="setU(${x.id},{active:${!x.active}})">${x.active ? 'Suspend' : 'Enable'}</button></td></tr>`).join('')}</table></div>`;
  },
};

// ---------- actions ----------
async function reloadTable() { try { $('#tb').innerHTML = table(await api(`/tickets?q=${encodeURIComponent(F.q)}&status=${encodeURIComponent(F.s)}`)); } catch (e) { toast(e.message); } }
async function analyzeNow() {
  const text = $('#t').value + ' ' + $('#d').value; if (text.trim().length < 8) return;
  const a = await api('/ai/analyze', { method: 'POST', body: { text } });
  $('#aip').innerHTML = `<b>✦ AI Analysis</b><div class="row"><span>Category</span>${badge(a.category)}</div><div class="row"><span>Priority</span>${badge(a.priority)}</div><div class="row"><span>Sentiment</span>${esc(a.sentiment)}</div><div class="row"><span>Department</span>${esc(a.department)}</div><div class="row"><span>Possible cause</span>${esc(a.possibleCause)}</div><div class="row"><span>Expected resolution</span><b>${esc(a.eta)}</b></div><p><b>Try:</b></p><ol>${a.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`;
}
async function submitT() { try { const t = await api('/tickets', { method: 'POST', body: { title: $('#t').value, description: $('#d').value, priority: $('#pr').value || undefined } }); toast(t.id + ' created and routed'); location.hash = '#/ticket/' + t.id; } catch (e) { toast(e.message); } }
async function reply(id) { try { await api(`/tickets/${id}/comments`, { method: 'POST', body: { text: $('#rp').value, internal: $('#in') && $('#in').checked } }); route(); } catch (e) { toast(e.message); } }
async function setT(id, body) { try { await api('/tickets/' + id, { method: 'PATCH', body }); toast('Ticket updated'); route(); } catch (e) { toast(e.message); } }
async function setU(id, body) { try { await api('/users/' + id, { method: 'PATCH', body }); toast('User updated'); route(); } catch (e) { toast(e.message); } }
async function say(m) { const i = $('#ci'), v = (m || i.value).trim(); if (!v) return; chat.push({ me: 1, t: v }); chat.push({ t: '… typing' }); await route();
  const r = await api('/chat', { method: 'POST', body: { message: v } }); chat.pop(); setTimeout(() => { chat.push({ t: r.reply.replace(/\*\*/g, '') }); route(); }, 600); }

// ---------- router ----------
async function route() {
  if (!tok()) return authPage();
  try {
    if (!me) me = await api('/me');
    const [p, a] = location.hash.slice(2).split('/'), name = pages[p] ? p : 'dashboard';
    const html = await pages[name](a); $('#app').innerHTML = shell(html, name);
    const ch = $('#ch'); if (ch) ch.scrollTop = 1e6;
  } catch (e) { if (/log in/i.test(e.message)) logout(); else $('#app').innerHTML = `<div class="pg"><div class="card">⚠ ${esc(e.message)}</div></div>`; }
}
addEventListener('hashchange', route); route();
