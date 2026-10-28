const express = require('express'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { analyze, chatReply } = require('./ai');
const app = express();
app.use(express.json());
// Only these frontend files are public (server.js and data/ stay private)
for (const f of ['styles.css', 'app.js']) app.get('/' + f, (req, res) => res.sendFile(path.join(__dirname, f)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ---------- tiny JSON "database" ----------
const FILE = path.join(__dirname, 'data', 'db.json');
const hash = p => crypto.createHash('sha256').update(p).digest('hex');
const now = () => new Date().toISOString();
function seed() {
  const users = [
    { id: 1, name: 'Admin User', email: 'admin@demo.com', pass: hash('admin123'), role: 'admin', dept: 'Administration', active: true },
    { id: 2, name: 'Priya N.', email: 'agent@demo.com', pass: hash('agent123'), role: 'agent', dept: 'Network Support', active: true },
    { id: 3, name: 'Arjun K.', email: 'arjun@demo.com', pass: hash('agent123'), role: 'agent', dept: 'Software Support', active: true },
    { id: 4, name: 'Meera S.', email: 'meera@demo.com', pass: hash('agent123'), role: 'agent', dept: 'Hardware Support', active: true },
    { id: 5, name: 'Alex Johnson', email: 'user@demo.com', pass: hash('user123'), role: 'user', dept: '', active: true },
  ];
  const T = [
    ['Wi-Fi not connecting', 'Network', 'High', 'In Progress', 2], ['Unable to access college portal', 'Software', 'Critical', 'Escalated', 3],
    ['Printer not working', 'Printing', 'Low', 'Assigned', 4], ['Password reset required', 'Account & Login', 'Medium', 'Resolved', 2],
    ['Laptop overheating', 'Hardware', 'High', 'Waiting for User', 4], ['Email login problem', 'Email', 'Medium', 'New', 3],
    ['Software installation error', 'Software', 'Medium', 'Closed', 3], ['Network speed issue', 'Network', 'Low', 'In Progress', 2],
  ];
  const tickets = T.map((t, i) => ({
    id: 'TKT-' + (1001 + i), title: t[0], description: t[0] + '. This has been happening since this morning and is affecting my work.',
    category: t[1], priority: t[2], status: t[3], agentId: t[4], userId: 5, sentiment: i % 2 ? 'Concerned' : 'Neutral',
    created: now(), updated: now(),
    comments: [{ by: 'Alex Johnson', role: 'user', text: 'Please help, still not resolved.', internal: false, at: now() }],
  }));
  return { users, tickets, nextTicket: 1009, nextUser: 6 };
}
let db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : seed();
const save = () => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); };
save();

// ---------- auth ----------
const sessions = new Map();
const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, dept: u.dept, active: u.active });
function auth(req, res, next) {
  const id = sessions.get((req.headers.authorization || '').replace('Bearer ', ''));
  const u = db.users.find(x => x.id === id);
  if (!u || !u.active) return res.status(401).json({ error: 'Please log in' });
  req.user = u; next();
}
const need = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Not allowed' });

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.users.find(x => x.email === String(email).toLowerCase() && x.pass === hash(String(password)));
  if (!u) return res.status(400).json({ error: 'Invalid email or password' });
  if (!u.active) return res.status(403).json({ error: 'Account suspended' });
  const token = crypto.randomUUID(); sessions.set(token, u.id);
  res.json({ token, user: pub(u) });
});
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !/\S+@\S+\.\S+/.test(email || '') || (password || '').length < 6) return res.status(400).json({ error: 'Name, valid email and 6+ char password required' });
  if (db.users.some(u => u.email === email.toLowerCase())) return res.status(400).json({ error: 'Email already registered' });
  const u = { id: db.nextUser++, name, email: email.toLowerCase(), pass: hash(password), role: 'user', dept: '', active: true };
  db.users.push(u); save();
  const token = crypto.randomUUID(); sessions.set(token, u.id);
  res.json({ token, user: pub(u) });
});
app.get('/api/me', auth, (req, res) => res.json(pub(req.user)));

// ---------- AI ----------
app.post('/api/ai/analyze', auth, (req, res) => res.json(analyze(req.body.text)));
app.post('/api/chat', auth, (req, res) => res.json({ reply: chatReply(req.body.message) }));

// ---------- tickets ----------
const visible = u => db.tickets.filter(t => u.role === 'user' ? t.userId === u.id : true);
const view = t => ({ ...t, agent: (db.users.find(u => u.id === t.agentId) || {}).name || 'Unassigned',
  requester: (db.users.find(u => u.id === t.userId) || {}).name });
app.get('/api/tickets', auth, (req, res) => {
  const { q = '', status = '' } = req.query;
  res.json(visible(req.user).filter(t => (!status || t.status === status) &&
    (t.title + t.id + t.category).toLowerCase().includes(q.toLowerCase())).map(view).reverse());
});
app.post('/api/tickets', auth, (req, res) => {
  const { title, description } = req.body || {};
  if (!title || !description || description.length < 10) return res.status(400).json({ error: 'Title and a longer description are required' });
  const ai = analyze(title + ' ' + description);
  const agent = db.users.find(u => u.role === 'agent' && u.active && u.dept === ai.department) || db.users.find(u => u.role === 'agent');
  const dup = db.tickets.find(t => t.userId === req.user.id && !/Resolved|Closed/.test(t.status) && t.category === ai.category);
  const t = { id: 'TKT-' + db.nextTicket++, title, description, category: req.body.category || ai.category,
    priority: req.body.priority || ai.priority, status: 'Assigned', agentId: agent && agent.id, userId: req.user.id,
    sentiment: ai.sentiment, ai, duplicateOf: dup ? dup.id : null, created: now(), updated: now(),
    comments: [{ by: 'TechAssist AI', role: 'ai', text: `Analyzed: ${ai.category}, ${ai.priority}, sentiment ${ai.sentiment}. Routed to ${ai.department}. Try: ${ai.steps.join('; ')}.`, internal: false, at: now() }] };
  db.tickets.push(t); save(); res.json(view(t));
});
app.get('/api/tickets/:id', auth, (req, res) => {
  const t = visible(req.user).find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Ticket not found' });
  const v = view(t); if (req.user.role === 'user') v.comments = v.comments.filter(c => !c.internal);
  res.json(v);
});
app.post('/api/tickets/:id/comments', auth, (req, res) => {
  const t = visible(req.user).find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Ticket not found' });
  if (!req.body.text || !req.body.text.trim()) return res.status(400).json({ error: 'Write something first' });
  t.comments.push({ by: req.user.name, role: req.user.role, text: req.body.text.trim(), internal: req.user.role !== 'user' && !!req.body.internal, at: now() });
  if (req.user.role === 'user' && t.status === 'Waiting for User') t.status = 'In Progress';
  t.updated = now(); save(); res.json({ ok: true });
});
app.patch('/api/tickets/:id', auth, need('agent', 'admin'), (req, res) => {
  const t = db.tickets.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Ticket not found' });
  ['status', 'priority'].forEach(k => { if (req.body[k]) t[k] = req.body[k]; });
  t.updated = now(); save(); res.json(view(t));
});

// ---------- stats, KB, users ----------
const count = (arr, k) => arr.reduce((m, x) => (m[x[k]] = (m[x[k]] || 0) + 1, m), {});
app.get('/api/stats', auth, (req, res) => {
  const ts = visible(req.user);
  res.json({ total: ts.length, open: ts.filter(t => !/Resolved|Closed/.test(t.status)).length,
    resolved: ts.filter(t => /Resolved|Closed/.test(t.status)).length, escalated: ts.filter(t => t.status === 'Escalated').length,
    byStatus: count(ts, 'status'), byCategory: count(ts, 'category'), byPriority: count(ts, 'priority'),
    slaCompliance: '94.6%', avgResponse: '4.2 min', aiResolved: '62%' });
});
const KB = [['Fix Wi-Fi connection drops', 'Network', 'Rejoin the network, renew your IP and update drivers.', 2840], ['Reset your portal password', 'Account & Login', 'Use self-service reset in 3 steps.', 5120],
  ['Printer offline? Clear the queue', 'Printing', 'Restart the spooler and reinstall the driver.', 1930], ['Laptop overheating checklist', 'Hardware', 'Clean vents, update BIOS, check fan.', 1410],
  ['Install software without admin rights', 'Software', 'Portable installs and request process.', 980], ['Set up email on mobile', 'Email', 'IMAP/Exchange settings explained.', 2210],
  ['Enable two-factor authentication', 'Security', 'Protect your account in minutes.', 3300], ['Blue screen error codes', 'System Issues', 'Common STOP codes explained.', 1750]]
  .map(a => ({ title: a[0], category: a[1], summary: a[2], views: a[3] }));
app.get('/api/kb', auth, (req, res) => res.json(KB.filter(a => (a.title + a.category + a.summary).toLowerCase().includes((req.query.q || '').toLowerCase()))));
app.get('/api/users', auth, need('admin'), (req, res) => res.json(db.users.map(pub)));
app.patch('/api/users/:id', auth, need('admin'), (req, res) => {
  const u = db.users.find(x => x.id === +req.params.id); if (!u) return res.status(404).json({ error: 'No such user' });
  if (req.body.role) u.role = req.body.role; if (typeof req.body.active === 'boolean') u.active = req.body.active;
  save(); res.json(pub(u));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TechAssist AI running -> http://localhost:${PORT}`));
