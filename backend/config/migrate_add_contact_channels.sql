-- Migration: Add contact channels (whatsapp, linkedin_url) to profiles table
-- Enables direct communication (WhatsApp and Email) between matched mentors and mentees upon acceptance.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255);
