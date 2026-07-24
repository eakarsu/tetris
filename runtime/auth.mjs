import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
export function hashPassword(password, salt = randomBytes(16).toString('hex')) { return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`; }
export function verifyPassword(password, stored) {
  const [salt, expectedHex] = String(stored || '').split(':'); if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex'); const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
const signature = (body) => createHmac('sha256', process.env.JWT_SECRET).update(body).digest('base64url');
export function issueToken(user) { const body = Buffer.from(JSON.stringify({ sub: user.id, email: user.email, role: user.role, exp: Date.now() + 8*60*60*1000 })).toString('base64url'); return `${body}.${signature(body)}`; }
export function verifyToken(token) {
  const [body, supplied] = String(token || '').split('.'); if (!body || !supplied) return null;
  const expected = Buffer.from(signature(body)); const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); return payload.exp > Date.now() ? payload : null;
}
