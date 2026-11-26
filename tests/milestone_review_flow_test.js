// End-to-end test of the milestone review workflow against a LOCAL backend + LOCAL database.
// NEVER point this at production: it creates accounts and writes directly to the database.
//
// Run (from the project root), with the backend running locally and email disabled:
//   cd backend && PORT=5055 RESEND_API_KEY= BREVO_API_KEY= SMTP_HOST= SMTP_USER= SMTP_PASS= node server.js
//   node tests/milestone_review_flow_test.js
// Creates three throwaway accounts and an accepted match, runs every scenario, then deletes them.
const path = require('path');
const BACKEND = path.resolve(__dirname, '../backend');
process.chdir(BACKEND);
require(path.join(BACKEND, 'node_modules/dotenv')).config({ path: path.join(BACKEND, '.env'), quiet: true });

const isLocal = (value) => /(^|[/@])(localhost|127\.0\.0\.1)([:/]|$)/.test(value);
const API = process.env.TEST_API_URL || 'http://localhost:5055/api';
if (!isLocal(API)) {
  console.error('Refusing to run against a non-local API: ' + API);
  process.exit(1);
}
if (process.env.DATABASE_URL ? !isLocal(process.env.DATABASE_URL) : !['localhost', '127.0.0.1', undefined].includes(process.env.DB_HOST)) {
  console.error('Refusing to run: backend/.env points at a non-local database.');
  process.exit(1);
}
const pool = require(path.join(BACKEND, 'config/db'));
const stamp = Date.now();
let pass = 0, fail = 0;

async function call(method, url, token, body) {
  const res = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data; try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

async function expect(name, promise, status) {
  const r = await promise;
  check(`${name} -> ${status}`, r.status === status, `(got ${r.status}: ${JSON.stringify(r.data)})`);
  return r;
}

(async () => {
  const ids = [];
  try {
    const reg = async (role, tag = role) => {
      const r = await call('POST', '/auth/register', null, {
        name: `Local Test ${role}`, email: `reviewtest-${tag}-${stamp}@example.test`, password: 'Test-pass-123', role,
      });
      if (r.status !== 201) throw new Error(`register ${role}: ${r.status} ${JSON.stringify(r.data)}`);
      ids.push(r.data.user.accountID);
      return { id: r.data.user.accountID, token: r.data.token };
    };
    const mentee = await reg('mentee');
    const mentor = await reg('mentor');
    const other = await reg('mentee', 'outsider');

    const m = await pool.query(
      `INSERT INTO matches ("menteeID", "mentorID", similarity_score, status) VALUES ($1, $2, 0.9, 'accepted') RETURNING "matchID"`,
      [mentee.id, mentor.id]
    );
    const matchID = m.rows[0].matchID;

    console.log('\n1. Setup');
    const g = await expect('mentee creates milestone with 2 tasks', call('POST', `/progress/${matchID}`, mentee.token, { title: 'Build login API', tasks: ['Write endpoint', 'Add tests'] }), 201);
    const goalID = g.data.goal.goalID;
    const [t1, t2] = g.data.goal.action_items.map((i) => i.itemID);

    console.log('\n2. Status can no longer be set directly');
    await expect('mentee PATCH status=completed blocked', call('PATCH', `/progress/goals/${goalID}`, mentee.token, { status: 'completed' }), 400);
    await expect('mentor PATCH status=completed blocked', call('PATCH', `/progress/goals/${goalID}`, mentor.token, { status: 'completed' }), 400);
    await expect('mentor cannot approve before submission', call('POST', `/progress/goals/${goalID}/review`, mentor.token, { decision: 'approve' }), 409);

    console.log('\n3. Submission rules');
    await expect('submit with unticked tasks blocked', call('POST', `/progress/goals/${goalID}/submit`, mentee.token, { note: 'done' }), 400);
    await expect('mentee ticks task 1', call('PATCH', `/progress/items/${t1}/toggle`, mentee.token), 200);
    const last = await expect('mentee ticks task 2', call('PATCH', `/progress/items/${t2}/toggle`, mentee.token), 200);
    check('ticking last task reports allGoalTasksCompleted', last.data.allGoalTasksCompleted === true);
    const afterTick = await call('GET', `/progress/${matchID}`, mentee.token);
    check('ticking last task does NOT auto-submit (still in_progress)', afterTick.data.goals[0].status === 'in_progress', afterTick.data.goals[0].status);
    await expect('submit without note blocked', call('POST', `/progress/goals/${goalID}/submit`, mentee.token, { note: '  ' }), 400);
    await expect('submit with javascript: link blocked', call('POST', `/progress/goals/${goalID}/submit`, mentee.token, { note: 'x', evidence_url: 'javascript:alert(1)' }), 400);
    await expect('mentor cannot submit', call('POST', `/progress/goals/${goalID}/submit`, mentor.token, { note: 'x' }), 403);
    await expect('unrelated user cannot submit', call('POST', `/progress/goals/${goalID}/submit`, other.token, { note: 'x' }), 403);
    await expect('mentee submits with note + link', call('POST', `/progress/goals/${goalID}/submit`, mentee.token, { note: 'Endpoint and tests done', evidence_url: 'https://github.com/example/repo' }), 200);
    await expect('double submit blocked', call('POST', `/progress/goals/${goalID}/submit`, mentee.token, { note: 'again' }), 409);

    console.log('\n4. Locked while under review');
    await expect('mentee cannot untick task', call('PATCH', `/progress/items/${t1}/toggle`, mentee.token), 409);
    await expect('mentee cannot add task', call('POST', `/progress/goals/${goalID}/items`, mentee.token, { task_text: 'sneaky' }), 409);
    await expect('mentee cannot delete task', call('DELETE', `/progress/items/${t1}`, mentee.token), 409);
    await expect('mentee cannot edit title', call('PATCH', `/progress/goals/${goalID}`, mentee.token, { title: 'Renamed' }), 409);
    await expect('mentee cannot delete milestone', call('DELETE', `/progress/goals/${goalID}`, mentee.token), 409);

    console.log('\n5. Mentor review');
    await expect('mentee cannot review', call('POST', `/progress/goals/${goalID}/review`, mentee.token, { decision: 'approve' }), 403);
    await expect('request_changes without reason blocked', call('POST', `/progress/goals/${goalID}/review`, mentor.token, { decision: 'request_changes', notes: '' }), 400);
    const rc = await expect('mentor requests changes with reason', call('POST', `/progress/goals/${goalID}/review`, mentor.token, { decision: 'request_changes', notes: 'Add a test for expired tokens' }), 200);
    check('status back to in_progress', rc.data.goal.status === 'in_progress');
    await expect('mentee can edit again after revision request', call('POST', `/progress/goals/${goalID}/items`, mentee.token, { task_text: 'Test expired tokens' }), 201);
    const p1 = await call('GET', `/progress/${matchID}`, mentee.token);
    const t3 = p1.data.goals[0].action_items.find((i) => !i.is_completed).itemID;
    await expect('mentee ticks new task', call('PATCH', `/progress/items/${t3}/toggle`, mentee.token), 200);
    await expect('mentee resubmits', call('POST', `/progress/goals/${goalID}/submit`, mentee.token, { note: 'Added expired-token test' }), 200);
    const ap = await expect('mentor approves', call('POST', `/progress/goals/${goalID}/review`, mentor.token, { decision: 'approve', notes: 'Nice work' }), 200);
    check('status completed with reviewed_at set', ap.data.goal.status === 'completed' && ap.data.goal.reviewed_at);
    await expect('approving twice blocked', call('POST', `/progress/goals/${goalID}/review`, mentor.token, { decision: 'approve' }), 409);

    console.log('\n6. Locked after approval, mentor can reopen');
    await expect('mentee cannot untick approved task', call('PATCH', `/progress/items/${t1}/toggle`, mentee.token), 409);
    await expect('mentor cannot untick approved task', call('PATCH', `/progress/items/${t1}/toggle`, mentor.token), 409);
    await expect('mentee cannot rename approved milestone', call('PATCH', `/progress/goals/${goalID}`, mentee.token, { title: 'Renamed' }), 409);
    await expect('mentee cannot delete approved milestone', call('DELETE', `/progress/goals/${goalID}`, mentee.token), 409);
    await expect('mentee cannot reopen', call('POST', `/progress/goals/${goalID}/reopen`, mentee.token, {}), 403);
    const ro = await expect('mentor reopens', call('POST', `/progress/goals/${goalID}/reopen`, mentor.token, { notes: 'One more check' }), 200);
    check('status in_progress after reopen', ro.data.goal.status === 'in_progress');

    console.log('\n7. Review history');
    const p2 = await call('GET', `/progress/${matchID}`, mentor.token);
    const goal = p2.data.goals[0];
    const actions = goal.review_history.map((h) => h.action).join(',');
    check('history records every step', actions === 'submitted,changes_requested,submitted,approved,reopened', actions);
    check('first submission keeps note + evidence link', goal.review_history[0].notes === 'Endpoint and tests done' && goal.review_history[0].evidence_url === 'https://github.com/example/repo');
    check('unrelated user cannot read progress', (await call('GET', `/progress/${matchID}`, other.token)).status === 403);

    console.log('\n8. Mentor delete still allowed; milestone with no tasks can be submitted');
    const g2 = await call('POST', `/progress/${matchID}`, mentee.token, { title: 'No-task milestone' });
    await expect('submit milestone with no tasks', call('POST', `/progress/goals/${g2.data.goal.goalID}/submit`, mentee.token, { note: 'Discussed in call' }), 200);
    await expect('mentor can delete a milestone under review', call('DELETE', `/progress/goals/${g2.data.goal.goalID}`, mentor.token), 200);
  } catch (err) {
    fail++;
    console.log('ERROR', err);
  } finally {
    if (ids.length) {
      await pool.query('DELETE FROM matches WHERE "menteeID" = ANY($1) OR "mentorID" = ANY($1)', [ids]);
      await pool.query('DELETE FROM account WHERE "accountID" = ANY($1)', [ids]);
      console.log(`\nCleaned up test accounts ${ids.join(', ')}`);
    }
    await pool.end();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
