-- Migration: Add 'suggested' status to matches table
-- This allows recommendations to be generated without automatically sending requests to mentors.
-- Mentee explicitly requests mentorship to move status from 'suggested' to 'pending'.

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE matches ADD CONSTRAINT matches_status_check
  CHECK (status IN ('suggested', 'pending', 'accepted', 'rejected'));

ALTER TABLE matches ALTER COLUMN status SET DEFAULT 'suggested';

ALTER TABLE matches ADD COLUMN IF NOT EXISTS message TEXT;
