// Tests who can view whose profile, and when contact details are shared.
// Runs the controllers in-process against the LOCAL database and cleans up after itself.
//
// NEVER point this at production: it creates accounts and writes directly to the database.
//
// Run from the project root:  node tests/profile_visibility_test.js
const path = require('path');
const BACKEND = path.resolve(__dirname, '../backend');
process.chdir(BACKEND);
require(path.join(BACKEND, 'node_modules/dotenv')).config({ path: path.join(BACKEND, '.env'), quiet: true });

const isLocal = (value) => /(^|[/@])(localhost|127\.0\.0\.1)([:/]|$)/.test(value);
if (process.env.DATABASE_URL ? !isLocal(process.env.DATABASE_URL) : !['localhost', '127.0.0.1', undefined].includes(process.env.DB_HOST)) {
  console.error('Refusing to run: backend/.env points at a non-local database.');
  process.exit(1);
}
for (const key of ['RESEND_API_KEY', 'BREVO_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) process.env[key] = '';

const pool = require(path.join(BACKEND, 'config/db'));
const profiles = require(path.join(BACKEND, 'controllers/profileController'));
const recs = require(path.join(BACKEND, 'controllers/recommendationController'));

const stamp = Date.now();
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

async function run(handler, user, { params = {}, body = {} } = {}) {
  let status = 200, data;
  const req = { user, params, body, headers: {}, ip: '127.0.0.1' };
  const res = { status(s) { status = s; return this; }, json(d) { data = d; return this; } };
  await handler(req, res);
  return { status, data };
}

(async () => {
  const ids = [];
  const makeUser = async (tag, role) => {
    const r = await pool.query(
      `INSERT INTO account (name, email, "passwordHash", role) VALUES ($1, $2, 'x', $3) RETURNING "accountID"`,
      [`Visibility ${tag}`, `visibility-${tag}-${stamp}@example.test`, role]
    );
    const id = r.rows[0].accountID;
    ids.push(id);
    await pool.query(
      `INSERT INTO profiles ("accountID", bio, skills, interests, experience_years, whatsapp, linkedin_url, embedding)
       VALUES ($1, $2, $3, $4, 3, '0712345678', 'linkedin.com/in/test', '[0.1, 0.2]')`,
      [id, `Bio of ${tag}`, ['Skill A', 'Skill B'], ['Interest A']]
    );
    return { accountID: id, role };
  };
  const match = (menteeID, mentorID, status, message = null) =>
    pool.query(
      `INSERT INTO matches ("menteeID", "mentorID", similarity_score, status, message) VALUES ($1, $2, 0.8, $3, $4) RETURNING "matchID"`,
      [menteeID, mentorID, status, message]
    ).then((r) => r.rows[0].matchID);
  const view = (viewer, target) => run(profiles.getProfileById, viewer, { params: { id: String(target.accountID) } });
  const noContacts = (d) => d.email === null && d.whatsapp === null && d.linkedin_url === null;

  try {
    const mentee = await makeUser('mentee', 'mentee');
    const other = await makeUser('mentee2', 'mentee');
    const suggested = await makeUser('mentor-suggested', 'mentor');
    const stranger = await makeUser('mentor-stranger', 'mentor');
    await match(mentee.accountID, suggested.accountID, 'suggested');
    const pendingID = await match(other.accountID, suggested.accountID, 'pending', 'Hello, I would love your guidance.');

    console.log('\n1. Own profile');
    const self = await view(mentee, mentee);
    check('200 with own contact details', self.status === 200 && !!self.data.email && self.data.whatsapp === '0712345678');
    check('embedding never returned', !('embedding' in self.data));

    console.log('\n2. Mentee viewing a suggested mentor (before requesting)');
    const s = await view(mentee, suggested);
    check('200 with bio, skills and interests', s.status === 200 && s.data.bio === 'Bio of mentor-suggested' && s.data.skills.length === 2 && s.data.interests.length === 1);
    check('contact details hidden', noContacts(s.data));
    check('embedding not returned', !('embedding' in s.data));
    check('mentor with no match -> 404', (await view(mentee, stranger)).status === 404);
    check('another mentee -> 404', (await view(mentee, other)).status === 404);

    console.log('\n3. Mentor viewing mentees');
    check('mentee who was only suggested (no request) -> 404', (await view(suggested, mentee)).status === 404);
    const p = await view(suggested, other);
    check('mentee who sent a request -> 200', p.status === 200 && p.data.bio === 'Bio of mentee2');
    check('contact details hidden while pending', noContacts(p.data));
    check('unrelated mentor -> 404', (await view(stranger, other)).status === 404);

    console.log('\n4. After the request is accepted');
    await pool.query(`UPDATE matches SET status = 'accepted' WHERE "matchID" = $1`, [pendingID]);
    const a = await view(suggested, other);
    check('mentor now sees contact details', a.status === 200 && !!a.data.email && a.data.whatsapp === '0712345678');
    const b = await view(other, suggested);
    check('mentee now sees contact details', b.status === 200 && !!b.data.email && !!b.data.linkedin_url);

    console.log('\n5. Match lists only include email once accepted');
    const list = await run(recs.getRecommendations, mentee);
    const row = list.data.matches.find((m) => m.mentor.accountID === suggested.accountID);
    check('mentee list: suggested mentor email hidden', row && row.mentor.email === null);
    const incoming = await run(recs.getIncomingRequests, suggested);
    const acc = incoming.data.matches.find((m) => m.mentee.accountID === other.accountID);
    check('mentor list: accepted mentee email present', acc && !!acc.mentee.email);
    check('mentor list: request message still included', acc && acc.message === 'Hello, I would love your guidance.');

    await pool.query(`UPDATE matches SET status = 'pending' WHERE "matchID" = $1`, [pendingID]);
    const incoming2 = await run(recs.getIncomingRequests, suggested);
    const pend = incoming2.data.matches.find((m) => m.mentee.accountID === other.accountID);
    check('mentor list: pending mentee email hidden', pend && pend.mentee.email === null);
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
    process.exit(fail ? 1 : 0);
  }
})();
