-- Migration: deduplicate matches and add unique constraint

-- 1. Remove duplicates — keep only the row with the highest similarity_score
--    (or the latest matchID as tiebreaker)
DELETE FROM matches
WHERE "matchID" IN (
  SELECT "matchID" FROM (
    SELECT "matchID",
           ROW_NUMBER() OVER (
             PARTITION BY "menteeID", "mentorID"
             ORDER BY similarity_score DESC NULLS LAST, "matchID" DESC
           ) AS rn
    FROM matches
  ) ranked
  WHERE rn > 1
);

-- 2. Add unique constraint if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_menteeid_mentorid_key'
      AND conrelid = 'matches'::regclass
  ) THEN
    ALTER TABLE matches ADD CONSTRAINT matches_menteeid_mentorid_key UNIQUE ("menteeID", "mentorID");
    RAISE NOTICE 'Constraint added.';
  ELSE
    RAISE NOTICE 'Constraint already exists, skipping.';
  END IF;
END $$;
