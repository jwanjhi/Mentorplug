// Tests linking Google sign-in to an existing email/password account.
// Runs the auth controller in-process against the LOCAL database. Google's ID-token
// check is stubbed (a real Google sign-in can't be scripted); everything after it
// (database, bcrypt, JWTs, email OTP) is real. Email sending is disabled.
//
// NEVER point this at production: it creates accounts and writes directly to the database.
//
// Run from the project root:  node tests/google_link_flow_test.js
const path = require('path');
const BACKEND = path.resolve(__dirname, '../backend');
process.chdir(BACKEND);
require(path.join(BACKEND, 'node_modules/dotenv')).config({ path: path.join(BACKEND, '.env'), quiet: true });

const isLocal = (value) => /(^|[/@])(localhost|127\.0\.0\.1)([:/]|$)/.test(value);
if (process.env.DATABASE_URL ? !isLocal(process.env.DATABASE_URL) : !['localhost', '127.0.0.1', undefined].includes(process.env.DB_HOST)) {
  console.error('Refusing to run: backend/.env points at a non-local database.');
  process.exit(1);
}

// No real emails
for (const key of ['RESEND_API_KEY', 'BREVO_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) process.env[key] = '';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id';

// Stub Google's token verification: the "idToken" we pass is a JSON payload
const { OAuth2Client } = require(path.join(BACKEND, 'node_modules/google-auth-library'));
OAuth2Client.prototype.verifyIdToken = async ({ idToken }) => {
  const payload = JSON.parse(idToken);
  return { getPayload: () => payload };
};

const bcrypt = require(path.join(BACKEND, 'node_modules/bcrypt'));
const jwt = require(path.join(BACKEND, 'node_modules/jsonwebtoken'));
const pool = require(path.join(BACKEND, 'config/db'));
const auth = require(path.join(BACKEND, 'controllers/authController'));
const authMiddleware = require(path.join(BACKEND, 'middleware/auth'));

const stamp = Date.now();
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

// Call a controller with a fake req/res
async function run(handler, body = {}, headers = {}) {
  let status = 200, data;
  const req = { body, headers: { 'user-agent': 'test', ...headers }, ip: '127.0.0.1' };
  const res = { status(s) { status = s; return this; }, json(d) { data = d; return this; } };
  await handler(req, res);
  return { status, data };
}

// Does the auth middleware accept this token as a login?
function middlewareAccepts(token) {
  let accepted = false;
  const res = { status() { return this; }, json() { return this; } };
  authMiddleware({ headers: { authorization: `Bearer ${token}` } }, res, () => { accepted = true; });
  return accepted;
}

const googleToken = (sub, email) => JSON.stringify({ sub, email, email_verified: true, name: 'Test User' });
const latestCode = async (accountID) =>
  (await pool.query(
    `SELECT code FROM email_mfa_codes WHERE "accountID" = $1 AND consumed = FALSE ORDER BY id DESC LIMIT 1`,
    [accountID]
  )).rows[0]?.code;

(async () => {
  const ids = [];
  const makeAccount = async (tag, { password = 'Correct-horse-1', mfa = true, googleId = null } = {}) => {
    const email = `googlelink-${tag}-${stamp}@example.test`;
    const hash = password ? await bcrypt.hash(password, 4) : null;
    const r = await pool.query(
      `INSERT INTO account (name, email, "passwordHash", role, mfa_enabled, "googleId")
       VALUES ($1, $2, $3, 'mentee', $4, $5) RETURNING "accountID"`,
      [`Link Test ${tag}`, email, hash, mfa, googleId]
    );
    ids.push(r.rows[0].accountID);
    return { id: r.rows[0].accountID, email };
  };
  const googleIdOf = async (id) => (await pool.query('SELECT "googleId" FROM account WHERE "accountID" = $1', [id])).rows[0].googleId;

  try {
    // Make sure the new column exists (normally created on server start)
    await pool.query('ALTER TABLE email_mfa_codes ADD COLUMN IF NOT EXISTS pending_google_id VARCHAR(255)');

    console.log('\n1. Google sign-in on an email/password account returns a link token');
    const a = await makeAccount('mfa-on');
    const gidA = `google-sub-a-${stamp}`;
    const conflict = await run(auth.googleAuth, { idToken: googleToken(gidA, a.email) });
    check('409 ACCOUNT_EXISTS_WITH_PASSWORD', conflict.status === 409 && conflict.data.code === 'ACCOUNT_EXISTS_WITH_PASSWORD');
    check('response includes linkToken + masked email', !!conflict.data.linkToken && /\*\*\*/.test(conflict.data.maskedEmail));
    check('nothing linked yet', (await googleIdOf(a.id)) === null);
    const linkToken = conflict.data.linkToken;

    console.log('\n2. Link token cannot be used as a login, and a login token cannot be used to link');
    check('auth middleware rejects the link token', !middlewareAccepts(linkToken));
    const sessionToken = jwt.sign({ accountID: a.id, role: 'mentee' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    check('/google/link rejects a session token', (await run(auth.linkGoogle, { linkToken: sessionToken, password: 'Correct-horse-1' })).status === 401);
    const expired = jwt.sign({ purpose: 'google_link', googleId: gidA, email: a.email }, `${process.env.JWT_SECRET}:google-account-link`, { expiresIn: -10 });
    check('/google/link rejects an expired link token', (await run(auth.linkGoogle, { linkToken: expired, password: 'Correct-horse-1' })).status === 401);

    console.log('\n3. Password + email code required before linking');
    check('wrong password -> 401', (await run(auth.linkGoogle, { linkToken, password: 'wrong' })).status === 401);
    check('still not linked after wrong password', (await googleIdOf(a.id)) === null);
    const step = await run(auth.linkGoogle, { linkToken, password: 'Correct-horse-1' });
    check('correct password -> email code required', step.status === 200 && step.data.mfaRequired === true && !!step.data.tempToken);
    check('still not linked before code is entered', (await googleIdOf(a.id)) === null);
    check('wrong code rejected', (await run(auth.verifyMfa, { tempToken: step.data.tempToken, code: '000000' })).status === 400);
    const code = await latestCode(a.id);
    const verified = await run(auth.verifyMfa, { tempToken: step.data.tempToken, code });
    check('correct code -> signed in, googleLinked true', verified.status === 200 && !!verified.data.token && verified.data.googleLinked === true);
    check('Google ID now stored on the account', (await googleIdOf(a.id)) === gidA);
    check('same code cannot be reused', (await run(auth.verifyMfa, { tempToken: step.data.tempToken, code })).status === 400);

    console.log('\n4. After linking, Google sign-in just works');
    const again = await run(auth.googleAuth, { idToken: googleToken(gidA, a.email) });
    check('Google sign-in -> 200 with session', again.status === 200 && again.data.user?.accountID === a.id && !!again.data.token);

    console.log('\n5. Accounts with two-factor sign-in turned off link with the password alone');
    const b = await makeAccount('mfa-off', { mfa: false });
    const gidB = `google-sub-b-${stamp}`;
    const c2 = await run(auth.googleAuth, { idToken: googleToken(gidB, b.email) });
    const direct = await run(auth.linkGoogle, { linkToken: c2.data.linkToken, password: 'Correct-horse-1' });
    check('signed in directly with googleLinked true', direct.status === 200 && direct.data.googleLinked === true && !!direct.data.token);
    check('Google ID stored', (await googleIdOf(b.id)) === gidB);

    console.log('\n6. Conflicts');
    const c = await makeAccount('other-google', { googleId: `google-sub-existing-${stamp}` });
    const c3 = await run(auth.googleAuth, { idToken: googleToken(`google-sub-new-${stamp}`, c.email) });
    check('account already linked to a different Google -> 409 on link', (await run(auth.linkGoogle, { linkToken: c3.data.linkToken, password: 'Correct-horse-1' })).status === 409);

    // Google ID already used by account A; try to link it to account D too
    const d = await makeAccount('dup', { mfa: false });
    const dupToken = jwt.sign({ purpose: 'google_link', googleId: gidA, email: d.email }, `${process.env.JWT_SECRET}:google-account-link`, { expiresIn: '10m' });
    const dup = await run(auth.linkGoogle, { linkToken: dupToken, password: 'Correct-horse-1' });
    check('Google ID already on another account -> signed in but googleLinked false', dup.status === 200 && dup.data.googleLinked === false);
    check('account D left unlinked', (await googleIdOf(d.id)) === null);

    console.log('\n7. Bug fixes');
    const e = await makeAccount('google-only', { password: null });
    const gidE = `google-sub-e-${stamp}`;
    const emailMatch = await run(auth.googleAuth, { idToken: googleToken(gidE, e.email) });
    check('Google sign-in for password-less account found by email -> 200 (was 500)', emailMatch.status === 200 && emailMatch.data.user?.accountID === e.id);
    const pwLogin = await run(auth.login, { email: e.email, password: 'anything' });
    check('password login on Google-only account -> 401 GOOGLE_ACCOUNT (was 500)', pwLogin.status === 401 && pwLogin.data.code === 'GOOGLE_ACCOUNT');

    console.log('\n8. Normal password login unchanged');
    const normal = await run(auth.login, { email: a.email, password: 'Correct-horse-1' });
    check('login with MFA -> code required', normal.status === 200 && normal.data.mfaRequired === true);
    const n2 = await run(auth.verifyMfa, { tempToken: normal.data.tempToken, code: await latestCode(a.id) });
    check('code -> session, no googleLinked field', n2.status === 200 && !!n2.data.token && !('googleLinked' in n2.data));
    check('login without MFA -> session', (await run(auth.login, { email: b.email, password: 'Correct-horse-1' })).data.token !== undefined);
  } catch (err) {
    fail++;
    console.log('ERROR', err);
  } finally {
    if (ids.length) {
      await pool.query('DELETE FROM account WHERE "accountID" = ANY($1)', [ids]);
      console.log(`\nCleaned up test accounts ${ids.join(', ')}`);
    }
    await pool.end();
    console.log(`\n${pass} passed, ${fail} failed`);
    // Let any pending (mock) email promises settle quietly
    setTimeout(() => process.exit(fail ? 1 : 0), 50);
  }
})();
