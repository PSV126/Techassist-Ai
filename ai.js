// Rule-based "AI" engine. Replace analyze() with a real LLM API call later.
const RULES = [
  { k: /wi-?fi|network|internet|connect|speed|slow|lan/, cat: 'Network', dept: 'Network Support', pri: 'High', eta: '2 hours',
    cause: 'Router/DHCP problem or weak signal', steps: ['Forget and rejoin the Wi-Fi network', 'Restart the router/modem', 'Run ipconfig /renew and ping 8.8.8.8'] },
  { k: /print|toner|spooler/, cat: 'Printing', dept: 'Hardware Support', pri: 'Low', eta: '4 hours',
    cause: 'Stalled print spooler or driver issue', steps: ['Check paper and toner', 'Clear the print queue', 'Restart the Print Spooler service', 'Reinstall the driver'] },
  { k: /password|login|log in|locked|credential|sign in/, cat: 'Account & Login', dept: 'Accounts', pri: 'Medium', eta: '30 minutes',
    cause: 'Expired password or account lockout', steps: ['Use the self-service password reset', 'Wait 15 minutes if locked out', 'Clear browser cache and cookies'] },
  { k: /overheat|hot|fan|battery|laptop|screen|keyboard/, cat: 'Hardware', dept: 'Hardware Support', pri: 'High', eta: '1 day',
    cause: 'Blocked vents, dust or failing fan', steps: ['Close heavy applications', 'Clean air vents', 'Update BIOS and drivers', 'Run hardware diagnostics'] },
  { k: /install|software|app|portal|error|crash|update/, cat: 'Software', dept: 'Software Support', pri: 'Medium', eta: '4 hours',
    cause: 'Missing admin rights, dependency or cached session', steps: ['Run the installer as administrator', 'Free at least 2 GB disk space', 'Clear temp files and retry', 'Share the exact error code'] },
  { k: /email|outlook|mail|inbox/, cat: 'Email', dept: 'IT Support', pri: 'Medium', eta: '2 hours',
    cause: 'Wrong server settings or expired token', steps: ['Re-enter your password', 'Verify IMAP/Exchange settings', 'Remove and re-add the account'] },
  { k: /virus|malware|phish|hack|breach|security/, cat: 'Security', dept: 'Security', pri: 'Critical', eta: '1 hour',
    cause: 'Possible compromise', steps: ['Disconnect from the network', 'Do not click suspicious links', 'Wait for the security team'] },
];
const FALLBACK = { cat: 'General', dept: 'IT Support', pri: 'Low', eta: '8 hours', cause: 'More detail needed', steps: ['Share the exact error message and a screenshot'] };

function analyze(text = '') {
  const t = text.toLowerCase();
  const r = RULES.find(x => x.k.test(t)) || FALLBACK;
  let priority = r.pri;
  if (/urgent|critical|outage|everyone|all users|data loss|down\b/.test(t)) priority = 'Critical';
  const neg = (t.match(/not working|cannot|can't|again|angry|terrible|urgent|worst|still|unacceptable/g) || []).length;
  return {
    category: r.cat, department: r.dept, priority,
    sentiment: neg > 1 ? 'Frustrated' : neg ? 'Concerned' : 'Neutral',
    possibleCause: r.cause, steps: r.steps, eta: r.eta,
    summary: text.length > 90 ? text.slice(0, 87) + '...' : text,
  };
}

function chatReply(msg = '') {
  if (/^(hi|hello|hey)\b/i.test(msg.trim())) return 'Hello! I am TechAssist AI. Tell me what is going wrong (Wi-Fi, printer, login, software, hardware...).';
  const a = analyze(msg);
  if (a.category === 'General') return 'Could you share the exact error message, your device, and when it started?';
  return `This looks like a **${a.category}** issue (likely cause: ${a.possibleCause}).\n` +
    a.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') + `\nIf this does not help, click "Create Ticket" (expected fix: ${a.eta}).`;
}
module.exports = { analyze, chatReply };
