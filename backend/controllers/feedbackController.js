const pool = require('../config/db');

/* ─────────────────────────────────────────────────────────────────────────────
   submitFeedback
   POST /api/feedback
   Accepts: { matchID, receiverID, rating, comment, category }
   Ensures rating is 1-5, associates giverID with authenticated user.
   Supports upsert: if user already rated this match, updates the rating & comment.
   ───────────────────────────────────────────────────────────────────────────── */
const submitFeedback = async (req, res) => {
  try {
    const giverID = req.user.accountID;
    const { matchID, receiverID: passedReceiverID, rating, comment, category = 'recommendation' } = req.body;

    const numRating = parseInt(rating, 10);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    let targetReceiverID = passedReceiverID ? parseInt(passedReceiverID, 10) : null;

    // If matchID is provided, verify match and deduce receiverID if missing
    if (matchID) {
      const matchRes = await pool.query(
        'SELECT "matchID", "menteeID", "mentorID" FROM matches WHERE "matchID" = $1',
        [matchID]
      );
      if (matchRes.rows.length === 0) {
        return res.status(404).json({ error: 'Match record not found' });
      }

      const match = matchRes.rows[0];
      if (match.menteeID !== giverID && match.mentorID !== giverID) {
        return res.status(403).json({ error: 'You are not a participant in this match' });
      }

      if (!targetReceiverID) {
        targetReceiverID = match.menteeID === giverID ? match.mentorID : match.menteeID;
      }
    }

    // Check if feedback already exists for this match + giver
    let existing;
    if (matchID) {
      existing = await pool.query(
        'SELECT "feedbackID" FROM feedback WHERE "matchID" = $1 AND "giverID" = $2',
        [matchID, giverID]
      );
    }

    let savedFeedback;
    if (existing && existing.rows.length > 0) {
      const updateRes = await pool.query(
        `UPDATE feedback
         SET rating = $1, comment = $2, category = $3, "receiverID" = $4, "createdAt" = CURRENT_TIMESTAMP
         WHERE "feedbackID" = $5
         RETURNING "feedbackID", "matchID", "giverID", "receiverID", rating, comment, category, "createdAt"`,
        [numRating, (comment || '').trim(), category, targetReceiverID, existing.rows[0].feedbackID]
      );
      savedFeedback = updateRes.rows[0];
    } else {
      const insertRes = await pool.query(
        `INSERT INTO feedback ("matchID", "giverID", "receiverID", rating, comment, category)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING "feedbackID", "matchID", "giverID", "receiverID", rating, comment, category, "createdAt"`,
        [matchID || null, giverID, targetReceiverID, numRating, (comment || '').trim(), category]
      );
      savedFeedback = insertRes.rows[0];
    }

    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback: savedFeedback,
    });
  } catch (err) {
    console.error('Error submitting feedback:', err);
    res.status(500).json({ error: 'Internal server error while saving feedback' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   getMatchFeedback
   GET /api/feedback/match/:matchId
   Retrieves feedback left on a specific match.
   ───────────────────────────────────────────────────────────────────────────── */
const getMatchFeedback = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { rows } = await pool.query(
      `SELECT f."feedbackID", f."matchID", f."giverID", f."receiverID", f.rating, f.comment, f.category, f."createdAt",
              g.name AS giver_name, g.role AS giver_role
       FROM feedback f
       JOIN account g ON g."accountID" = f."giverID"
       WHERE f."matchID" = $1
       ORDER BY f."createdAt" DESC`,
      [matchId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error fetching match feedback:', err);
    res.status(500).json({ error: 'Failed to fetch match feedback' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   getMyFeedback
   GET /api/feedback/my
   Retrieves all feedback submitted by the authenticated user.
   ───────────────────────────────────────────────────────────────────────────── */
const getMyFeedback = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const { rows } = await pool.query(
      `SELECT f."feedbackID", f."matchID", f."receiverID", f.rating, f.comment, f.category, f."createdAt",
              r.name AS receiver_name
       FROM feedback f
       LEFT JOIN account r ON r."accountID" = f."receiverID"
       WHERE f."giverID" = $1
       ORDER BY f."createdAt" DESC`,
      [accountID]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error fetching user feedback:', err);
    res.status(500).json({ error: 'Failed to fetch user feedback' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   getFeedbackSummary
   GET /api/feedback/summary
   Aggregates system-wide evaluation metrics (average rating, distribution, total)
   for Chapter 5 Dissertation Evaluation & Benchmarking.
   ───────────────────────────────────────────────────────────────────────────── */
const getFeedbackSummary = async (req, res) => {
  try {
    const totalRes = await pool.query('SELECT COUNT(*) AS total, AVG(rating) AS avg_rating FROM feedback');
    const distRes = await pool.query(
      `SELECT rating, COUNT(*) AS count
       FROM feedback
       GROUP BY rating
       ORDER BY rating DESC`
    );

    const total = parseInt(totalRes.rows[0].total, 10) || 0;
    const avgRating = totalRes.rows[0].avg_rating ? parseFloat(Number(totalRes.rows[0].avg_rating).toFixed(2)) : 0;

    res.json({
      total,
      avgRating,
      distribution: distRes.rows,
    });
  } catch (err) {
    console.error('Error fetching feedback summary:', err);
    res.status(500).json({ error: 'Failed to fetch feedback summary' });
  }
};

module.exports = {
  submitFeedback,
  getMatchFeedback,
  getMyFeedback,
  getFeedbackSummary,
};
