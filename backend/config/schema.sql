-- MentorPlug Database Schema
-- Run this script to drop existing tables and recreate them afresh.

-- 1. Drop existing tables if they exist (in cascade order)
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS account CASCADE;

-- 2. Create account table (matching backend/controllers/authController.js)
CREATE TABLE account (
    "accountID" SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('mentor', 'mentee')),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create profiles table (for bio, skills, interests & NLP embeddings)
CREATE TABLE profiles (
    "profileID" SERIAL PRIMARY KEY,
    "accountID" INT UNIQUE NOT NULL REFERENCES account("accountID") ON DELETE CASCADE,
    bio TEXT,
    skills TEXT[],
    interests TEXT[],
    experience_years INT DEFAULT 0,
    embedding JSONB, -- Stores SBERT vector embeddings as array/JSON
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create matches / recommendations table
CREATE TABLE matches (
    "matchID" SERIAL PRIMARY KEY,
    "menteeID" INT NOT NULL REFERENCES account("accountID") ON DELETE CASCADE,
    "mentorID" INT NOT NULL REFERENCES account("accountID") ON DELETE CASCADE,
    similarity_score NUMERIC(5, 4),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create feedback table (for ratings, reviews, and match evaluation)
CREATE TABLE feedback (
    "feedbackID" SERIAL PRIMARY KEY,
    "matchID" INT REFERENCES matches("matchID") ON DELETE SET NULL,
    "giverID" INT NOT NULL REFERENCES account("accountID") ON DELETE CASCADE,
    "receiverID" INT REFERENCES account("accountID") ON DELETE CASCADE,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    category VARCHAR(50) DEFAULT 'recommendation' CHECK (category IN ('recommendation', 'mentorship_session', 'platform')),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
