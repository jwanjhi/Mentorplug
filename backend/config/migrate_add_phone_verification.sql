-- Migration: Add phone verification tracking and OTP store
-- Enables verified direct contact between mentors and mentees.

-- 1. Add phone_verified flag to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- 2. Create phone_verifications table for 6-digit OTP codes
CREATE TABLE IF NOT EXISTS phone_verifications (
    id SERIAL PRIMARY KEY,
    "accountID" INT NOT NULL REFERENCES account("accountID") ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    code VARCHAR(10) NOT NULL,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for speedy OTP lookup
CREATE INDEX IF NOT EXISTS idx_phone_verifications_lookup 
ON phone_verifications ("accountID", phone, verified, "expiresAt");

