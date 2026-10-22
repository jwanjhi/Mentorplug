const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');

/**
 * Spawns nlp/recommend.py to compute cosine similarity between
 * a mentee profile and candidate mentor profiles using Sentence-BERT.
 * Passes input JSON via stdin, reads ranked JSON from stdout, and enforces 60s timeout.
 */
const runRecommendScript = (pythonCmd, scriptPath, payloadJson, timeoutMs = 60000) => {
  return new Promise((resolve, reject) => {
    let resolvedOrRejected = false;
    let timer = null;

    const child = spawn(pythonCmd, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (!resolvedOrRejected) {
          resolvedOrRejected = true;
          try {
            child.kill();
          } catch (e) {
            // Process may already be dead
          }
          reject(new Error(`Recommendation process timed out after ${timeoutMs / 1000} seconds`));
        }
      }, timeoutMs);
    }

    child.on('error', (err) => {
      if (!resolvedOrRejected) {
        resolvedOrRejected = true;
        if (timer) clearTimeout(timer);
        reject(err);
      }
    });

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('close', (code) => {
      if (resolvedOrRejected) return;
      resolvedOrRejected = true;
      if (timer) clearTimeout(timer);

      if (code !== 0) {
        return reject(new Error(`Recommendation script exited with code ${code}: ${stderrData || stdoutData}`));
      }

      try {
        const trimmed = stdoutData.trim();
        if (!trimmed) {
          return reject(new Error('Recommendation process returned empty output'));
        }

        const parsed = JSON.parse(trimmed);
        if (parsed.error) {
          return reject(new Error(parsed.error));
        }

        if (!Array.isArray(parsed)) {
          return reject(new Error('Expected JSON array of recommendations from NLP script'));
        }

        resolve(parsed);
      } catch (parseErr) {
        reject(new Error(`Failed to parse recommendation output: ${parseErr.message}`));
      }
    });

    child.stdin.write(payloadJson);
    child.stdin.end();
  });
};

/**
 * Executes recommendation script checking local virtualenv first,
 * falling back to system python if venv not found.
 */
const getRecommendationsFromPython = async (payload) => {
  const scriptPath = path.resolve(__dirname, '../../nlp/recommend.py');
  const payloadJson = JSON.stringify(payload);

  const candidates = [];
  const venvPythonWin = path.resolve(__dirname, '../../.venv/Scripts/python.exe');
  const venvPythonUnix = path.resolve(__dirname, '../../.venv/bin/python');
  const venvPython = process.platform === 'win32' ? venvPythonWin : venvPythonUnix;

  if (process.env.PYTHON_PATH) {
    candidates.push(process.env.PYTHON_PATH);
  }
  if (fs.existsSync(venvPython)) {
    candidates.push(venvPython);
  }
  if (process.platform === 'win32') {
    candidates.push('python', 'py');
  } else {
    candidates.push('python3', 'python');
  }

  const timeoutMs = parseInt(process.env.NLP_TIMEOUT_MS, 10) || 60000;

  let lastError = null;
  for (const pythonCmd of candidates) {
    try {
      return await runRecommendScript(pythonCmd, scriptPath, payloadJson, timeoutMs);
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`Recommendation failed: ${lastError?.message || 'Unknown error'}`);
};

/**
 * Concatenates bio, skills, and interests into a clean text string.
 */
const formatProfileText = (profile) => {
  const bio = (profile.bio || '').trim();
  const skills = Array.isArray(profile.skills) ? profile.skills.join(', ') : '';
  const interests = Array.isArray(profile.interests) ? profile.interests.join(', ') : '';
  return `${bio} ${skills} ${interests}`.trim();
};

/**
 * GET /api/recommendations
 * Protected by auth middleware, mentee only.
 * Matches authenticated mentee against candidate mentors using SBERT semantic similarity.
 */
const getRecommendations = async (req, res) => {
  try {
    // 1. Check req.user.role is "mentee" — return 403 if not
    if (req.user?.role !== 'mentee') {
      return res.status(403).json({ message: 'Access denied: mentees only' });
    }

    const menteeAccountID = req.user?.accountID;
    if (!menteeAccountID) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // 2. Get the authenticated mentee's profile from profiles table
    const menteeProfileQuery = `
      SELECT "profileID", "accountID", bio, skills, interests, experience_years, embedding
      FROM profiles
      WHERE "accountID" = $1
    `;
    const menteeProfileResult = await pool.query(menteeProfileQuery, [menteeAccountID]);

    // Return 400 "Please complete your profile first" if no profile found
    if (menteeProfileResult.rows.length === 0) {
      return res.status(400).json({ message: 'Please complete your profile first' });
    }

    const menteeProfile = menteeProfileResult.rows[0];

    // 3. Concatenate mentee's bio + skills + interests into one text string
    const menteeText = formatProfileText(menteeProfile);
    if (!menteeText) {
      return res.status(400).json({ message: 'Please complete your profile first' });
    }

    // 4. Get all mentor profiles from profiles table where account role is "mentor" and "accountID" != mentee's accountID
    const mentorsQuery = `
      SELECT 
        p."profileID",
        p."accountID",
        p.bio,
        p.skills,
        p.interests,
        p.experience_years,
        p.embedding,
        a.name,
        a.email,
        a.role
      FROM profiles p
      JOIN account a ON p."accountID" = a."accountID"
      WHERE a.role = 'mentor' AND p."accountID" != $1
    `;
    const mentorsResult = await pool.query(mentorsQuery, [menteeAccountID]);

    // Return 400 "No mentors available yet" if no mentors found
    if (mentorsResult.rows.length === 0) {
      return res.status(400).json({ message: 'No mentors available yet' });
    }

    // 5. Concatenate each mentor's bio + skills + interests into one text string
    const mentorMap = new Map();
    const mentorProfilesPayload = [];

    for (const mentor of mentorsResult.rows) {
      mentorMap.set(mentor.accountID, mentor);
      const text = formatProfileText(mentor);
      mentorProfilesPayload.push({
        id: mentor.accountID,
        text
      });
    }

    // 6. Spawn nlp/recommend.py as child process with JSON payload
    const rankedResults = await getRecommendationsFromPython({
      menteeProfile: menteeText,
      mentorProfiles: mentorProfilesPayload
    });

    // 7. For the top result, save a record to matches table
    if (rankedResults.length > 0) {
      const topMentor = rankedResults[0];
      const insertMatchQuery = `
        INSERT INTO matches ("menteeID", "mentorID", similarity_score, status)
        VALUES ($1, $2, $3, $4)
        RETURNING "matchID", "menteeID", "mentorID", similarity_score, status, "createdAt"
      `;
      await pool.query(insertMatchQuery, [
        menteeAccountID,
        topMentor.id,
        topMentor.score,
        'pending'
      ]);
    }

    // 8. Join ranked results with full mentor profile data from profiles and account tables
    // 9. Return ranked list for each mentor with accountID, name, email, bio, skills, interests, experience_years, score
    const rankedMentors = rankedResults
      .map((item) => {
        const mentor = mentorMap.get(item.id);
        if (!mentor) return null;
        return {
          accountID: mentor.accountID,
          name: mentor.name,
          email: mentor.email,
          bio: mentor.bio,
          skills: mentor.skills,
          interests: mentor.interests,
          experience_years: mentor.experience_years,
          score: item.score
        };
      })
      .filter(Boolean);

    return res.status(200).json(rankedMentors);
  } catch (error) {
    console.error('Error in getRecommendations controller:', error);
    return res.status(500).json({
      message: 'Server error generating recommendations',
      error: error.message
    });
  }
};

module.exports = {
  getRecommendations,
  getRecommendationsFromPython,
  formatProfileText
};
