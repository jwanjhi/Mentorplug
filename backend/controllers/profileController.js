const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');

/**
 * Spawns a Python child process to execute nlp/generate_embedding.py.
 * Reads text from stdin and expects a 384-dimensional JSON array on stdout.
 * Implements a 60-second timeout.
 */
const runEmbeddingScript = (pythonCmd, scriptPath, inputText, timeoutMs = 60000) => {
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
            // Process may have already terminated
          }
          reject(new Error(`Embedding generation timed out after ${timeoutMs / 1000} seconds`));
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
        return reject(new Error(`Python process exited with code ${code}: ${stderrData || stdoutData}`));
      }

      try {
        const trimmed = stdoutData.trim();
        if (!trimmed) {
          return reject(new Error('Embedding process returned empty output'));
        }

        const parsed = JSON.parse(trimmed);
        if (parsed.error) {
          return reject(new Error(parsed.error));
        }

        if (!Array.isArray(parsed) || parsed.length !== 384) {
          if (Array.isArray(parsed)) {
            return resolve(parsed);
          }
          return reject(new Error('Expected JSON array of 384 dimensions from embedding process'));
        }

        resolve(parsed);
      } catch (parseErr) {
        reject(new Error(`Failed to parse embedding output: ${parseErr.message}`));
      }
    });

    // Write input text to Python stdin and close stream
    child.stdin.write(inputText);
    child.stdin.end();
  });
};

/**
 * Generates dense vector embedding by checking local venv first,
 * falling back to system python if venv not found.
 */
const generateEmbedding = async (inputText) => {
  const scriptPath = path.resolve(__dirname, '../../nlp/generate_embedding.py');

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
      return await runEmbeddingScript(pythonCmd, scriptPath, inputText, timeoutMs);
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`Embedding generation failed: ${lastError?.message || 'Unknown error'}`);
};

/**
 * POST /api/profiles
 * Create or update mentor/mentee profile.
 * Generates 384-dimensional SBERT embedding from bio, skills, and interests.
 */
const createOrUpdateProfile = async (req, res) => {
  try {
    const accountID = req.user?.accountID;
    if (!accountID) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { bio, skills, interests, experience_years } = req.body;

    // Validate that bio, skills, and interests are all present and non-empty
    if (
      !bio ||
      typeof bio !== 'string' ||
      bio.trim() === '' ||
      !skills ||
      !Array.isArray(skills) ||
      skills.length === 0 ||
      !interests ||
      !Array.isArray(interests) ||
      interests.length === 0
    ) {
      return res.status(400).json({
        message: 'bio, skills, and interests are all required and must be non-empty'
      });
    }

    // Validate that array items are non-empty strings
    const hasEmptySkills = skills.some((s) => typeof s !== 'string' || s.trim() === '');
    const hasEmptyInterests = interests.some((i) => typeof i !== 'string' || i.trim() === '');
    if (hasEmptySkills || hasEmptyInterests) {
      return res.status(400).json({
        message: 'skills and interests must contain non-empty strings'
      });
    }

    const cleanSkills = skills.map((s) => s.trim());
    const cleanInterests = interests.map((i) => i.trim());
    const expYears = (experience_years !== undefined && experience_years !== null)
      ? (parseInt(experience_years, 10) || 0)
      : 0;

    // Concatenate bio + skills.join(", ") + interests.join(", ") into one string
    const textToEmbed = `${bio.trim()} ${cleanSkills.join(', ')} ${cleanInterests.join(', ')}`;

    // Generate 384-dimensional embedding via Python script
    const embedding = await generateEmbedding(textToEmbed);

    // Check if a profile already exists for this "accountID"
    const checkQuery = 'SELECT "profileID" FROM profiles WHERE "accountID" = $1';
    const checkResult = await pool.query(checkQuery, [accountID]);

    let savedProfile;
    let isUpdate = false;

    if (checkResult.rows.length > 0) {
      // UPDATE existing profile
      isUpdate = true;
      const updateQuery = `
        UPDATE profiles
        SET bio = $1,
            skills = $2,
            interests = $3,
            experience_years = $4,
            embedding = $5,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "accountID" = $6
        RETURNING "profileID", "accountID", bio, skills, interests, experience_years, embedding, "updatedAt"
      `;
      const updateResult = await pool.query(updateQuery, [
        bio.trim(),
        cleanSkills,
        cleanInterests,
        expYears,
        JSON.stringify(embedding),
        accountID
      ]);
      savedProfile = updateResult.rows[0];
    } else {
      // INSERT new profile
      const insertQuery = `
        INSERT INTO profiles ("accountID", bio, skills, interests, experience_years, embedding)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING "profileID", "accountID", bio, skills, interests, experience_years, embedding, "updatedAt"
      `;
      const insertResult = await pool.query(insertQuery, [
        accountID,
        bio.trim(),
        cleanSkills,
        cleanInterests,
        expYears,
        JSON.stringify(embedding)
      ]);
      savedProfile = insertResult.rows[0];
    }

    return res.status(201).json({
      message: isUpdate ? 'Profile updated successfully' : 'Profile created successfully',
      profile: savedProfile
    });
  } catch (error) {
    console.error('Error in createOrUpdateProfile controller:', error);
    return res.status(500).json({
      message: 'Server error saving profile',
      error: error.message
    });
  }
};

/**
 * GET /api/profiles/me
 * Returns current authenticated user's profile joined with account details.
 */
const getMyProfile = async (req, res) => {
  try {
    const accountID = req.user?.accountID;
    if (!accountID) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const profileQuery = `
      SELECT 
        p."profileID",
        p."accountID",
        p.bio,
        p.skills,
        p.interests,
        p.experience_years,
        p.embedding,
        p."updatedAt",
        a.name,
        a.email,
        a.role
      FROM profiles p
      JOIN account a ON p."accountID" = a."accountID"
      WHERE p."accountID" = $1
    `;
    const result = await pool.query(profileQuery, [accountID]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error in getMyProfile controller:', error);
    return res.status(500).json({ message: 'Server error fetching profile' });
  }
};

/**
 * GET /api/profiles/:id
 * Returns a specific mentor's profile by their accountID.
 */
const getProfileById = async (req, res) => {
  try {
    const accountID = parseInt(req.params.id, 10);
    if (isNaN(accountID)) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    const profileQuery = `
      SELECT 
        p."profileID",
        p."accountID",
        p.bio,
        p.skills,
        p.interests,
        p.experience_years,
        p.embedding,
        p."updatedAt",
        a.name,
        a.email,
        a.role
      FROM profiles p
      JOIN account a ON p."accountID" = a."accountID"
      WHERE p."accountID" = $1
    `;
    const result = await pool.query(profileQuery, [accountID]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error in getProfileById controller:', error);
    return res.status(500).json({ message: 'Server error fetching profile' });
  }
};

module.exports = {
  createOrUpdateProfile,
  getMyProfile,
  getProfileById,
  generateEmbedding
};
