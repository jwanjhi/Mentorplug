const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const pool   = require('../config/db');

/* ── Storage configuration ───────────────────────────────────────────────────── */
const UPLOAD_DIR = path.resolve(__dirname, '../uploads/avatars');

// Ensure directory exists at module load time
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    // Use accountID so the same file is overwritten on re-upload
    const accountID = req.user?.accountID ?? 'unknown';
    cb(null, `avatar_${accountID}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB cap
});

/* ── POST /api/profiles/avatar ─────────────────────────────────────────────── */
const uploadAvatar = [
  upload.single('avatar'),

  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file received. Please select a JPEG, PNG, or WebP file.' });
      }

      const accountID  = req.user.accountID;
      const avatarUrl  = `/uploads/avatars/${req.file.filename}`;

      // Upsert: create the profile row if it doesn't exist yet, otherwise update avatar_url
      await pool.query(
        `INSERT INTO profiles ("accountID", avatar_url)
         VALUES ($1, $2)
         ON CONFLICT ("accountID") DO UPDATE SET avatar_url = EXCLUDED.avatar_url`,
        [accountID, avatarUrl]
      );

      return res.status(200).json({ avatarUrl });
    } catch (err) {
      console.error('uploadAvatar error:', err);
      return res.status(500).json({ error: 'Upload failed.', detail: err.message });
    }
  },
];

/* ── DELETE /api/profiles/avatar ───────────────────────────────────────────── */
const deleteAvatar = async (req, res) => {
  try {
    const accountID = req.user.accountID;

    // Fetch current avatar_url
    const { rows } = await pool.query(
      `SELECT avatar_url FROM profiles WHERE "accountID" = $1`,
      [accountID]
    );

    if (rows.length && rows[0].avatar_url) {
      const filePath = path.join(UPLOAD_DIR, path.basename(rows[0].avatar_url));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query(
      `UPDATE profiles SET avatar_url = NULL WHERE "accountID" = $1`,
      [accountID]
    );

    return res.status(200).json({ message: 'Avatar removed.' });
  } catch (err) {
    console.error('deleteAvatar error:', err);
    return res.status(500).json({ error: 'Delete failed.', detail: err.message });
  }
};

module.exports = { uploadAvatar, deleteAvatar };
