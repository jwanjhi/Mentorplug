/**
 * MentorPlug - Database Mentor Seeder
 * Script: backend/scripts/seed_database_mentors.js
 *
 * Ingests the 48 clean mentor profiles from data/mentor_seeds.json into PostgreSQL:
 * 1. Upserts each mentor into the 'account' table (role = 'mentor').
 * 2. Upserts profile data, bio, skills, interests, and pre-computed 384-d SBERT embeddings into 'profiles'.
 * 3. Preserves existing accounts and relationships without conflict.
 */

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/db');

async function seedMentors() {
  const seedsPath = path.resolve(__dirname, '../../data/mentor_seeds.json');
  if (!fs.existsSync(seedsPath)) {
    console.error(`Error: Seed file not found at ${seedsPath}. Run export_mentor_seeds.py first.`);
    process.exit(1);
  }

  const mentors = JSON.parse(fs.readFileSync(seedsPath, 'utf8'));
  console.log(`Starting database seed for ${mentors.length} mentor profiles...`);

  // Default password hash for seeded mentor accounts ('Password123!')
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  let insertedCount = 0;
  let updatedCount = 0;

  for (const mentor of mentors) {
    try {
      // 1. Upsert into account table
      const accountRes = await pool.query(
        `INSERT INTO account (name, email, "passwordHash", role, "authProvider")
         VALUES ($1, $2, $3, 'mentor', 'local')
         ON CONFLICT (email) DO UPDATE 
         SET name = EXCLUDED.name, role = 'mentor'
         RETURNING "accountID", (xmax = 0) AS is_new`,
        [mentor.name, mentor.email, defaultPasswordHash]
      );

      const accountID = accountRes.rows[0].accountID;
      const isNew = accountRes.rows[0].is_new;

      // 2. Upsert into profiles table with 384-d SBERT vector
      await pool.query(
        `INSERT INTO profiles (
           "accountID", bio, skills, interests, experience_years, whatsapp, linkedin_url, embedding, "updatedAt"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         ON CONFLICT ("accountID") DO UPDATE SET
           bio = EXCLUDED.bio,
           skills = EXCLUDED.skills,
           interests = EXCLUDED.interests,
           experience_years = EXCLUDED.experience_years,
           whatsapp = EXCLUDED.whatsapp,
           linkedin_url = EXCLUDED.linkedin_url,
           embedding = EXCLUDED.embedding,
           "updatedAt" = CURRENT_TIMESTAMP`,
        [
          accountID,
          mentor.bio,
          mentor.skills,
          mentor.interests,
          mentor.experience_years,
          mentor.whatsapp,
          mentor.linkedin_url,
          JSON.stringify(mentor.embedding)
        ]
      );

      if (isNew) {
        insertedCount++;
      } else {
        updatedCount++;
      }
    } catch (err) {
      console.error(`Failed to seed mentor ${mentor.email}:`, err.message);
    }
  }

  // Verification count
  const countRes = await pool.query(`SELECT COUNT(*) AS total FROM account WHERE role = 'mentor'`);
  const profileCountRes = await pool.query(
    `SELECT COUNT(*) AS total FROM profiles p JOIN account a ON a."accountID" = p."accountID" WHERE a.role = 'mentor'`
  );

  console.log('='.repeat(70));
  console.log(`Database Seeding Complete!`);
  console.log(`- New mentors inserted: ${insertedCount}`);
  console.log(`- Existing mentors updated: ${updatedCount}`);
  console.log(`- Total mentors in database: ${countRes.rows[0].total}`);
  console.log(`- Total mentor profiles with SBERT embeddings: ${profileCountRes.rows[0].total}`);
  console.log('='.repeat(70));

  await pool.end();
}

seedMentors().catch((err) => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});

