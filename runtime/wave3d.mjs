// Wave 3D: authenticated tasks, record search/export, and grounded AI over
// a player's own session stats. Provider call only when OPENROUTER_API_KEY
// or OPENAI_API_KEY is configured; otherwise a labelled deterministic
// fallback (aiGenerated:false) computed from the supplied stats.
import crypto from 'node:crypto';
export const TASK_STATUSES = ['todo', 'in_progress', 'done'];
export function validateTaskInput(body, { partial = false } = {}) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = []; const value = {};
  if (!partial || input.title !== undefined) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title || title.length > 200) errors.push('Title must contain 1-200 characters'); else value.title = title;
  }
  if (input.status !== undefined) {
    if (!TASK_STATUSES.includes(input.status)) errors.push('Status must be one of: ' + TASK_STATUSES.join(', ')); else value.status = input.status;
  } else if (!partial) value.status = 'todo';
  if (input.notes !== undefined) value.notes = String(input.notes || '').slice(0, 2000);
  else if (!partial) value.notes = '';
  return { errors, value };
}
export function createTaskStore() {
  const tasks = new Map();
  return {
    list(owner, filters = {}) { return filterRecords([...tasks.values()].filter((t) => String(t.owner) === String(owner)), filters); },
    create(owner, value) { const now = new Date().toISOString(); const task = { id: crypto.randomUUID(), owner: String(owner), ...value, createdAt: now, updatedAt: now }; tasks.set(task.id, task); return task; },
    update(owner, id, value) { const task = tasks.get(id); if (!task || String(task.owner) !== String(owner)) return null; Object.assign(task, value, { updatedAt: new Date().toISOString() }); return task; },
  };
}
export function filterRecords(rows, { q = '', status = '' } = {}) {
  const needle = String(q || '').trim().toLowerCase();
  return (rows || []).filter((row) => {
    if (status && String(row.status || '') !== status) return false;
    if (needle && !JSON.stringify(row).toLowerCase().includes(needle)) return false;
    return true;
  });
}
export function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object');
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
function statsOf(input) {
  const s = input && typeof input === 'object' ? input : {};
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  return { score: num(s.score), lines: num(s.lines), level: num(s.level), pieces: num(s.pieces), durationSeconds: num(s.durationSeconds) };
}
export function deterministicSessionSummary(s) {
  return { summary: `Score ${s.score} from ${s.lines} line(s) at level ${s.level} with ${s.pieces} piece(s) in ${s.durationSeconds}s.`, score: s.score, linesCleared: s.lines, level: s.level, piecesPlaced: s.pieces, durationSeconds: s.durationSeconds, emptySession: s.pieces === 0 };
}
export function deterministicDrillPlan(s) {
  const focus = s.lines === 0 ? 'Practice clearing single lines before chasing Tetrises.' : s.pieces > 0 && s.lines / s.pieces < 0.2 ? 'Drill downstacking: clear lines earlier instead of building high.' : 'Drill T-piece setups and keep the well open.';
  return { recommendation: focus, rationale: `${s.lines} line(s) from ${s.pieces} piece(s).`, nextActions: ['Play one 40-line Sprint focusing only on the recommendation.', 'Save the next session stats and compare.'] };
}
export function deterministicScoreAnalysis(s) {
  const perPiece = s.pieces ? Math.round((s.score / s.pieces) * 10) / 10 : 0;
  return { summary: `Average ${perPiece} point(s) per piece over ${s.durationSeconds}s.`, pointsPerPiece: perPiece, score: s.score, zeroScore: s.score === 0, nextActions: perPiece < 100 ? ['Review line-clear efficiency in a slower practice game.'] : ['Maintain pace; try the next level.'] };
}
const FALLBACKS = { 'session-summary': deterministicSessionSummary, 'drill-plan': deterministicDrillPlan, 'score-analysis': deterministicScoreAnalysis };
export async function runWaveAi(kind, input, deps = {}) {
  const fallback = FALLBACKS[kind]; if (!fallback) return null;
  const stats = statsOf(input);
  const env = deps.env || process.env;
  const key = env.OPENROUTER_API_KEY || env.OPENAI_API_KEY;
  if (key) {
    try {
      const useOpenRouter = Boolean(env.OPENROUTER_API_KEY);
      const url = useOpenRouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      const model = useOpenRouter ? (env.OPENROUTER_MODEL || 'openai/gpt-4o-mini') : (env.OPENAI_MODEL || 'gpt-4o-mini');
      const res = await (deps.fetchImpl || fetch)(url, { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, temperature: 0.3, max_tokens: 500, messages: [{ role: 'system', content: 'You are a Tetris coach. Use only the supplied session stats, reply with labelled sections, and do not invent gameplay telemetry.' }, { role: 'user', content: `Feature ${kind}; stats: ${JSON.stringify(stats)}` }] }) });
      if (!res.ok) throw new Error('Provider returned ' + res.status);
      const payload = await res.json();
      const text = (payload?.choices?.[0]?.message?.content || '').trim();
      if (text) return { source: useOpenRouter ? 'openrouter' : 'openai', model, aiGenerated: true, feature: kind, result: text };
    } catch { /* fall through to labelled deterministic fallback */ }
  }
  return { ...fallback(stats), aiGenerated: false, source: 'deterministic-fallback', feature: kind, notice: 'AI provider is not configured; this deterministic result was computed from the supplied session stats.' };
}
// Readable labelled rendering of AI JSON, preserving false, 0, and empty values.
export function formatAiSections(value) {
  const label = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  if (value === null || value === undefined) return 'Not supplied';
  if (typeof value !== 'object') return value === '' ? 'Empty string' : String(value);
  if (Array.isArray(value)) return value.length ? value.map((v) => '- ' + formatAiSections(v)).join('\n') : 'No items';
  return Object.entries(value).map(([k, v]) => `${label(k)}: ${formatAiSections(v)}`).join('\n');
}
