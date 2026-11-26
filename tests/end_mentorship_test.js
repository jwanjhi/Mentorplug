// Tests ending a mentorship (with a reason) and withdrawing a pending request.
// Runs the controllers in-process against the LOCAL database and cleans up after itself.
// Email sending is disabled.
//
// NEVER point this at production: it creates accounts and writes directly to the database.
//
// Run from the project root:  node tests/end_mentorship_test.js
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
const recs = require(path.join(BACKEND, 'controllers/recommendationController'));
const progress = require(path.join(BACKEND, 'controllers/progressController'));
const feedback = require(path.join(BACKEND, 'controllers/feedbackController'));
const profiles = require(path.join(BACKEND, 'controllers/profileController'));

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

// Same migration the server runs on startup
const MIGRATION = `
  ALTER TABLE matches ADD COLUMN IF NOT EXISTS ended_by INT REFERENCES account("accountID") ON DELETE SET NULL;
  ALTER TABLE matches ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE matches ADD COLUMN IF NOT EXISTS end_reason VARCHAR(40);
  ALTER TABLE matches ADD COLUMN IF NOT EXISTS end_reason_detail TEXT;
  ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;
  ALTER TABLE matches ADD CONSTRAINT matches_status_check
    CHECK (status IN ('suggested', 'pending', 'accepted', 'rejected', 'ended'));
`;

(async () => {
  const ids = [];
  const makeUser = async (tag, role) => {
    const r = await pool.query(
      `INSERT INTO account (name, email, "passwordHash", role) VALUES ($1, $2, 'x', $3) RETURNING "accountID"`,
      [`End ${tag}`, `endtest-${tag}-${stamp}@example.test`, role]
    );
    const id = r.rows[0].accountID;
    ids.push(id);
    await pool.query(
      `INSERT INTO profiles ("accountID", bio, skills, interests, whatsapp) VALUES ($1, 'bio', '{A}', '{B}', '0712345678')`,
      [id]
    );
    return { accountID: id, role };
  };
  const matchRow = async (id) => (await pool.query('SELECT * FROM matches WHERE "matchID" = $1', [id])).rows[0];
  const end = (user, id, body) => run(recs.endMentorship, user, { params: { id: String(id) }, body });

  try {
    await pool.query(MIGRATION);
    const mentee = await makeUser('mentee', 'mentee');
    const mentor = await makeUser('mentor', 'mentor');
    const mentor2 = await makeUser('mentor2', 'mentor');
    const stranger = await makeUser('stranger', 'mentee');
    const matchID = (await pool.query(
      `INSERT INTO matches ("menteeID", "mentorID", similarity_score, status) VALUES ($1, $2, 0.7, 'accepted') RETURNING "matchID"`,
      [mentee.accountID, mentor.accountID]
    )).rows[0].matchID;
    const pendingID = (await pool.query(
      `INSERT INTO matches ("menteeID", "mentorID", similarity_score, status, message) VALUES ($1, $2, 0.6, 'pending', 'Hi there') RETURNING "matchID"`,
      [mentee.accountID, mentor2.accountID]
    )).rows[0].matchID;
    await run(progress.createGoal, mentee, { params: { matchId: String(matchID) }, body: { title: 'Learn SQL', tasks: ['Read chapter 1'] } });

    console.log('\n1. Validation');
    check('no reason -> 400', (await end(mentee, matchID, {})).status === 400);
    check('unknown reason -> 400', (await end(mentee, matchID, { reason: 'bogus' })).status === 400);
    check('prototype key as reason -> 400', (await end(mentee, matchID, { reason: 'toString' })).status === 400);
    check('mentor-only reason used by mentee -> 400', (await end(mentee, matchID, { reason: 'no_capacity' })).status === 400);
    check('"other" without own reason -> 400', (await end(mentee, matchID, { reason: 'other', detail: '   ' })).status === 400);
    check('reason over 500 chars -> 400', (await end(mentee, matchID, { reason: 'other', detail: 'x'.repeat(501) })).status === 400);
    check('non-participant -> 404', (await end(stranger, matchID, { reason: 'goals_achieved' })).status === 404);
    check('pending (not accepted) match cannot be ended -> 404', (await end(mentee, pendingID, { reason: 'goals_achieved' })).status === 404);
    check('still accepted after failed attempts', (await matchRow(matchID)).status === 'accepted');

    console.log('\n2. Mentee ends with their own reason');
    const ok = await end(mentee, matchID, { reason: 'other', detail: '  Moving abroad for school  ' });
    check('200 with ended info', ok.status === 200 && ok.data.ended.by === 'you' && ok.data.ended.reason === 'other');
    const row = await matchRow(matchID);
    check('stored: status ended, ended_by, reason, trimmed detail', row.status === 'ended' && row.ended_by === mentee.accountID && row.end_reason === 'other' && row.end_reason_detail === 'Moving abroad for school' && !!row.ended_at);
    check('ending again -> 404', (await end(mentor, matchID, { reason: 'goals_achieved' })).status === 404);

    console.log('\n3. Both sides see it as ended, contact details hidden');
    const mine = (await run(recs.getRecommendations, mentee)).data.matches.find((m) => m.matchid === matchID);
    check('mentee list: ended by you', mine?.status === 'ended' && mine.ended.by === 'you' && mine.ended.reason_label === 'Other');
    check('mentee list: mentor email and WhatsApp hidden', mine?.mentor.email === null && mine.mentor.profile.whatsapp === null);
    const theirs = (await run(recs.getIncomingRequests, mentor)).data.matches.find((m) => m.matchid === matchID);
    check('mentor list: ended by them, with detail', theirs?.status === 'ended' && theirs.ended.by === 'them' && theirs.ended.detail === 'Moving abroad for school');
    check('mentor list: mentee email hidden', theirs?.mentee.email === null);
    const prof = await run(profiles.getProfileById, mentor, { params: { id: String(mentee.accountID) } });
    check('mentor can still open the profile, contacts hidden', prof.status === 200 && prof.data.email === null && prof.data.whatsapp === null);

    console.log('\n4. Milestones read-only, feedback still allowed');
    const prog = await run(progress.getMatchProgress, mentee, { params: { matchId: String(matchID) } });
    check('milestones still readable', prog.status === 200 && prog.data.goals?.length === 1);
    check('cannot add a milestone -> 409', (await run(progress.createGoal, mentor, { params: { matchId: String(matchID) }, body: { title: 'New' } })).status === 409);
    const goalID = prog.data.goals[0].goalID;
    check('cannot edit a milestone -> 409', (await run(progress.updateGoal, mentee, { params: { goalId: String(goalID) }, body: { title: 'Edited' } })).status === 409);
    check('cannot delete a milestone -> 409', (await run(progress.deleteGoal, mentor, { params: { goalId: String(goalID) } })).status === 409);
    const fb = await run(feedback.submitFeedback, mentor, { body: { matchID, rating: 4, comment: 'Good luck!' } });
    check('feedback can be left after ending', fb.status === 200 || fb.status === 201, JSON.stringify(fb.data));

    console.log('\n5. Requesting again after it ended');
    check('mentor cannot accept an ended match -> 404', (await run(recs.updateMatchStatus, mentor, { params: { id: String(matchID) }, body: { status: 'accepted' } })).status === 404);
    const again = await run(recs.sendMatchRequest, mentee, { params: { id: String(matchID) }, body: { message: 'Back again' } });
    check('mentee can send a new request', again.status === 200);
    const row2 = await matchRow(matchID);
    check('pending again, end details cleared', row2.status === 'pending' && row2.ended_by === null && row2.end_reason === null);
    check('mentor can accept the new request', (await run(recs.updateMatchStatus, mentor, { params: { id: String(matchID) }, body: { status: 'accepted' } })).status === 200);
    check('accepted match cannot be re-requested -> 404', (await run(recs.sendMatchRequest, mentee, { params: { id: String(matchID) }, body: {} })).status === 404);
    const byMentor = await end(mentor, matchID, { reason: 'no_capacity' });
    check('mentor can end with a mentor reason', byMentor.status === 200 && byMentor.data.ended.reason_label === 'No longer have capacity to mentor');

    console.log('\n6. Withdrawing a pending request');
    check('mentor cannot withdraw -> 403', (await run(recs.withdrawRequest, mentor2, { params: { id: String(pendingID) } })).status === 403);
    check('other mentee cannot withdraw -> 404', (await run(recs.withdrawRequest, stranger, { params: { id: String(pendingID) } })).status === 404);
    check('mentee withdraws -> 200', (await run(recs.withdrawRequest, mentee, { params: { id: String(pendingID) } })).status === 200);
    const row3 = await matchRow(pendingID);
    check('back to suggested, message cleared', row3.status === 'suggested' && row3.message === null);
    const incoming = (await run(recs.getIncomingRequests, mentor2)).data.matches;
    check('mentor no longer sees the request', !incoming.some((m) => m.matchid === pendingID));
    check('withdrawing again -> 404', (await run(recs.withdrawRequest, mentee, { params: { id: String(pendingID) } })).status === 404);
    check('mentor cannot accept a withdrawn request -> 404', (await run(recs.updateMatchStatus, mentor2, { params: { id: String(pendingID) }, body: { status: 'accepted' } })).status === 404);
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
    setTimeout(() => process.exit(fail ? 1 : 0), 50);
  }
})();
