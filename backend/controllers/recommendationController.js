const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { notifyMenteeMatchAccepted } = require('../services/emailService');

/* ─────────────────────────────────────────────────────────────────────────────
   NLP helper – spawns nlp/recommend.py with JSON via stdin
   ───────────────────────────────────────────────────────────────────────────── */
const runRecommendScript = (pythonCmd, scriptPath, payloadJson, timeoutMs = 60000) => {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;

    const child = spawn(pythonCmd, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdoutData = '';
    let stderrData = '';

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { child.kill(); } catch (_) {}
          reject(new Error(`Recommendation process timed out after ${timeoutMs / 1000}s`));
        }
      }, timeoutMs);
    }

    child.on('error', (err) => {
      if (!settled) { settled = true; if (timer) clearTimeout(timer); reject(err); }
    });
    child.stdout.on('data', (c) => { stdoutData += c.toString(); });
    child.stderr.on('data', (c) => { stderrData += c.toString(); });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (code !== 0) return reject(new Error(`Script exited ${code}: ${stderrData || stdoutData}`));
      try {
        const trimmed = stdoutData.trim();
        if (!trimmed) return reject(new Error('Empty output from NLP script'));
        const parsed = JSON.parse(trimmed);
        if (parsed.error) return reject(new Error(parsed.error));
        if (!Array.isArray(parsed)) return reject(new Error('Expected JSON array from NLP script'));
        resolve(parsed);
      } catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
    });

    child.stdin.write(payloadJson);
    child.stdin.end();
  });
};

const getRecommendationsFromPython = async (payload) => {
  const scriptPath = path.resolve(__dirname, '../../nlp/recommend.py');
  const payloadJson = JSON.stringify(payload);
  const venvPython = process.platform === 'win32'
    ? path.resolve(__dirname, '../../.venv/Scripts/python.exe')
    : path.resolve(__dirname, '../../.venv/bin/python');

  const candidates = [];
  if (process.env.PYTHON_PATH) candidates.push(process.env.PYTHON_PATH);
  if (fs.existsSync(venvPython)) candidates.push(venvPython);
  candidates.push(...(process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']));

  const timeoutMs = parseInt(process.env.NLP_TIMEOUT_MS, 10) || 60000;
  let lastError;
  for (const cmd of candidates) {
    try { return await runRecommendScript(cmd, scriptPath, payloadJson, timeoutMs); }
    catch (e) { lastError = e; }
  }
  throw new Error(`NLP recommendation failed: ${lastError?.message || 'Unknown error'}`);
};

const formatProfileText = (profile) => {
  const bio = (profile.bio || '').trim();
  const skills = Array.isArray(profile.skills) ? profile.skills.join(', ') : '';
  const interests = Array.isArray(profile.interests) ? profile.interests.join(', ') : '';
  return `${bio} ${skills} ${interests}`.trim();
};

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/recommendations
   Returns existing saved matches for the authenticated mentee (no NLP run).
   ───────────────────────────────────────────────────────────────────────────── */
const getRecommendations = async (req, res) => {
  try {
    if (req.user?.role !== 'mentee') return res.status(403).json({ error: 'Mentees only' });
    const menteeID = req.user.accountID;

    const { rows } = await pool.query(
      `SELECT m."matchID" AS matchid, m."mentorID", m.similarity_score, m.status,
              a.name, a.email,
              p.bio, p.skills, p.interests, p.experience_years, p.avatar_url,
              p.whatsapp, p.linkedin_url,
              f.rating AS feedback_rating, f.comment AS feedback_comment
       FROM   matches m
       JOIN   account a ON a."accountID" = m."mentorID"
       LEFT JOIN profiles p ON p."accountID" = m."mentorID"
       LEFT JOIN feedback f ON f."matchID" = m."matchID" AND f."giverID" = $1
       WHERE  m."menteeID" = $1
       ORDER  BY m.similarity_score DESC`,
      [menteeID]
    );

    const matches = rows.map((r) => ({
      matchid: r.matchid,
      similarity_score: r.similarity_score,
      status: r.status,
      feedback: r.feedback_rating ? {
        rating: r.feedback_rating,
        comment: r.feedback_comment
      } : null,
      mentor: {
        accountID: r.mentorID,
        name: r.name,
        email: r.email,
        profile: {
          bio: r.bio,
          skills: r.skills,
          interests: r.interests,
          experience_years: r.experience_years,
          avatar_url: r.avatar_url,
          whatsapp: r.status === 'accepted' ? r.whatsapp : null,
          linkedin_url: r.status === 'accepted' ? r.linkedin_url : null,
        }
      }
    }));

    return res.status(200).json({ matches });
  } catch (err) {
    console.error('getRecommendations error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/recommendations
   Runs NLP matching and saves all ranked matches to the DB.
   ───────────────────────────────────────────────────────────────────────────── */
const runAndSaveRecommendations = async (req, res) => {
  try {
    if (req.user?.role !== 'mentee') return res.status(403).json({ error: 'Mentees only' });
    const menteeID = req.user.accountID;

    // Get mentee profile
    const { rows: menteeRows } = await pool.query(
      `SELECT bio, skills, interests, experience_years, avatar_url FROM profiles WHERE "accountID" = $1`,
      [menteeID]
    );
    if (!menteeRows.length) return res.status(400).json({ error: 'Please complete your profile first before searching for mentors.' });

    const menteeText = formatProfileText(menteeRows[0]);
    if (!menteeText) return res.status(400).json({ error: 'Please add your bio, skills, and interests to your profile first.' });

    // Get all mentor profiles
    const { rows: mentorRows } = await pool.query(
      `SELECT p."accountID", p.bio, p.skills, p.interests, p.experience_years, p.avatar_url,
              a.name, a.email
       FROM   profiles p
       JOIN   account a ON a."accountID" = p."accountID"
       WHERE  a.role = 'mentor' AND p."accountID" != $1`,
      [menteeID]
    );
    if (!mentorRows.length) return res.status(400).json({ error: 'No mentors are available yet. Please check back later.' });

    // Run NLP
    const payload = {
      menteeProfile: menteeText,
      mentorProfiles: mentorRows.map((m) => ({ id: m.accountID, text: formatProfileText(m) }))
    };
    const ranked = await getRecommendationsFromPython(payload);

    // Upsert all ranked matches into DB as 'suggested'
    const mentorMap = new Map(mentorRows.map((m) => [m.accountID, m]));
    const saved = [];
    for (const item of ranked) {
      const mentor = mentorMap.get(item.id);
      if (!mentor) continue;
      const { rows: upsertRows } = await pool.query(
        `INSERT INTO matches ("menteeID", "mentorID", similarity_score, status)
         VALUES ($1, $2, $3, 'suggested')
         ON CONFLICT ("menteeID", "mentorID") DO UPDATE
           SET similarity_score = EXCLUDED.similarity_score,
               status = CASE 
                 WHEN matches.status IN ('pending', 'accepted', 'rejected') THEN matches.status 
                 ELSE 'suggested' 
               END,
               "createdAt"      = NOW()
         RETURNING "matchID" AS matchid, similarity_score, status`,
        [menteeID, item.id, item.score]
      );
      saved.push({
        matchid:          upsertRows[0].matchid,
        similarity_score: upsertRows[0].similarity_score,
        status:           upsertRows[0].status,
        mentor: {
          accountID: mentor.accountID,
          name:      mentor.name,
          email:     mentor.email,
          profile: {
            bio:              mentor.bio,
            skills:           mentor.skills,
            interests:        mentor.interests,
            experience_years: mentor.experience_years,
            avatar_url:       mentor.avatar_url
          }
        }
      });
    }

    return res.status(200).json({ matches: saved.sort((a, b) => b.similarity_score - a.similarity_score) });
  } catch (err) {
    console.error('runAndSaveRecommendations error:', err);
    return res.status(500).json({ error: 'Recommendation engine error', detail: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/recommendations/incoming
   Returns all matches where the authenticated user is the mentor.
   Only returns matches where the mentee explicitly requested mentorship ('pending', 'accepted', 'rejected').
   ───────────────────────────────────────────────────────────────────────────── */
const getIncomingRequests = async (req, res) => {
  try {
    if (req.user?.role !== 'mentor') return res.status(403).json({ error: 'Mentors only' });
    const mentorID = req.user.accountID;

    const { rows } = await pool.query(
      `SELECT m."matchID" AS matchid, m."menteeID", m.similarity_score, m.status, m.message,
              a.name, a.email,
              p.bio, p.skills, p.interests, p.experience_years, p.avatar_url,
              p.whatsapp, p.linkedin_url,
              f.rating AS feedback_rating, f.comment AS feedback_comment
       FROM   matches m
       JOIN   account a ON a."accountID" = m."menteeID"
       LEFT JOIN profiles p ON p."accountID" = m."menteeID"
       LEFT JOIN feedback f ON f."matchID" = m."matchID" AND f."giverID" = $1
       WHERE  m."mentorID" = $1 AND m.status IN ('pending', 'accepted', 'rejected')
       ORDER  BY m."createdAt" DESC`,
      [mentorID]
    );

    const matches = rows.map((r) => ({
      matchid: r.matchid,
      similarity_score: r.similarity_score,
      status: r.status,
      message: r.message,
      feedback: r.feedback_rating ? {
        rating: r.feedback_rating,
        comment: r.feedback_comment
      } : null,
      mentee: {
        accountID: r.menteeID,
        name: r.name,
        email: r.email,
        profile: {
          bio: r.bio,
          skills: r.skills,
          interests: r.interests,
          experience_years: r.experience_years,
          avatar_url: r.avatar_url,
          whatsapp: r.status === 'accepted' ? r.whatsapp : null,
          linkedin_url: r.status === 'accepted' ? r.linkedin_url : null,
        }
      }
    }));

    return res.status(200).json({ matches });
  } catch (err) {
    console.error('getIncomingRequests error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   PATCH /api/recommendations/:id/status
   Mentor updates match status: 'accepted' or 'rejected'.
   ───────────────────────────────────────────────────────────────────────────── */
const updateMatchStatus = async (req, res) => {
  try {
    if (req.user?.role !== 'mentor') return res.status(403).json({ error: 'Mentors only' });
    const mentorID = req.user.accountID;
    const matchID  = req.params.id;
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be "accepted" or "rejected"' });
    }

    const { rowCount } = await pool.query(
      `UPDATE matches SET status = $1
       WHERE "matchID" = $2 AND "mentorID" = $3`,
      [status, matchID, mentorID]
    );
    if (!rowCount) return res.status(404).json({ error: 'Match not found or access denied' });

    // When accepted, automatically dispatch email notification to the mentee
    if (status === 'accepted') {
      try {
        const { rows: details } = await pool.query(
          `SELECT 
             mentee_acc.name AS mentee_name, mentee_acc.email AS mentee_email,
             mentor_acc.name AS mentor_name, mentor_acc.email AS mentor_email,
             mentor_prof.whatsapp AS mentor_whatsapp
           FROM matches m
           JOIN account mentee_acc ON mentee_acc."accountID" = m."menteeID"
           JOIN account mentor_acc ON mentor_acc."accountID" = m."mentorID"
           LEFT JOIN profiles mentor_prof ON mentor_prof."accountID" = m."mentorID"
           WHERE m."matchID" = $1`,
          [matchID]
        );
        if (details.length > 0) {
          const d = details[0];
          notifyMenteeMatchAccepted({
            menteeEmail: d.mentee_email,
            menteeName: d.mentee_name,
            mentorName: d.mentor_name,
            mentorEmail: d.mentor_email,
            mentorWhatsapp: d.mentor_whatsapp,
          });
        }
      } catch (notifyErr) {
        console.error('Failed to dispatch match accepted email:', notifyErr.message);
      }
    }

    return res.status(200).json({ message: `Match ${status}` });
  } catch (err) {
    console.error('updateMatchStatus error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/recommendations/:id/request
   Mentee sends a (re-)request message for an existing match row.
   ───────────────────────────────────────────────────────────────────────────── */
const sendMatchRequest = async (req, res) => {
  try {
    if (req.user?.role !== 'mentee') return res.status(403).json({ error: 'Mentees only' });
    const menteeID = req.user.accountID;
    const matchID  = req.params.id;
    const { message } = req.body || {};

    const { rowCount } = await pool.query(
      `UPDATE matches SET status = 'pending', message = COALESCE($3, message)
       WHERE "matchID" = $1 AND "menteeID" = $2`,
      [matchID, menteeID, message ? message.trim() : null]
    );
    if (!rowCount) return res.status(404).json({ error: 'Match not found or access denied' });

    return res.status(200).json({ message: 'Request sent' });
  } catch (err) {
    console.error('sendMatchRequest error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};

module.exports = {
  getRecommendations,
  runAndSaveRecommendations,
  getIncomingRequests,
  updateMatchStatus,
  sendMatchRequest,
  getRecommendationsFromPython,
  formatProfileText
};
