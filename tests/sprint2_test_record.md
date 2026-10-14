# Sprint 2 — Test Record

## Overview
This document records the verification and validation test results for Sprint 2 of MentorPlug, covering authentication, profile management, and the NLP-based mentor-mentee recommendation pipeline.

- **System:** MentorPlug API (Node.js + Express + PostgreSQL + Sentence-BERT NLP)
- **Test Environment:** Local / Postman v11 / Node.js LTS / Python 3.11 (Sentence-BERT `all-MiniLM-L6-v2`)
- **Database:** PostgreSQL (`mentorplug`)
- **Date:** October 2026
- **Result Summary:** 14 / 14 Passed (100%)

---

## Test Record Table

| Test # | Description | Expected Result | Actual Result | Status | Notes |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | `POST /api/auth/register` with valid mentor data | `201 Created` + JWT token + user details | `201 Created` with JWT token and user account details | **Passed** | Mentee and mentor accounts registered with bcrypt password hashing (cost factor 10). |
| **2** | `POST /api/auth/register` with duplicate email | `409 Conflict` | `409 Conflict` with `{"message": "Email already exists"}` | **Passed** | Unique constraint enforced on `account.email`. |
| **3** | `POST /api/auth/login` with valid credentials | `200 OK` + JWT token + user details | `200 OK` with `token` and `user` payload | **Passed** | Returns signed JWT containing `accountID` and `role`. |
| **4** | `POST /api/auth/login` with wrong password | `401 Unauthorized` | `401 Unauthorized` with `{"message": "Invalid credentials"}` | **Passed** | Bcrypt hash comparison fails securely without account leakage. |
| **5** | `GET /api/auth/me` with valid JWT | `200 OK` + user details | `200 OK` returning `accountID`, `name`, `email`, `role`, and `createdAt` | **Passed** | Excludes `passwordHash` from returned JSON payload. |
| **6** | `GET /api/auth/me` with no token | `401 Unauthorized` | `401 Unauthorized` with `{"message": "No token provided"}` | **Passed** | `authMiddleware` intercepts missing `Bearer` authorization header. |
| **7** | `POST /api/profiles` with all fields | `201 Created` + profile saved | `201 Created` with saved profile object and 384-dim SBERT embedding | **Passed** | Concatenates bio, skills, and interests; spawns `nlp/generate_embedding.py` to generate dense vector; stores skills/interests as `TEXT[]` and embedding as `JSONB`. |
| **8** | `POST /api/profiles` with missing bio | `400 Bad Request` validation error | `400 Bad Request` with `{"message": "bio, skills, and interests are all required and must be non-empty"}` | **Passed** | Validates bio, skills, and interests before invoking NLP child process. |
| **9** | `POST /api/profiles` with mentor JWT | `201 Created` | `201 Created` with `profile` object | **Passed** | Successfully creates/upserts mentor profile linked to mentor's `accountID`. |
| **10** | `GET /api/profiles/me` after saving | `200 OK` + profile data | `200 OK` with full profile joined with `account` (`name`, `email`, `role`) | **Passed** | SQL JOIN between `profiles` and `account` on `"accountID"` retrieves combined user profile. |
| **11** | `GET /api/profiles/me` before saving | `404 Not Found` | `404 Not Found` with `{"message": "Profile not found"}` | **Passed** | Returns 404 when an authenticated account exists but has not completed their profile. |
| **12** | `GET /api/recommendations` as mentee with profile | `200 OK` + ranked list | `200 OK` with ranked JSON array of mentors sorted by similarity score | **Passed** | Spawns `nlp/recommend.py`; computes cosine similarity; inserts top match into `matches` table (`"pending"` status); returns mentors with scores. |
| **13** | `GET /api/recommendations` as mentor | `403 Forbidden` | `403 Forbidden` with `{"message": "Access denied: mentees only"}` | **Passed** | Role-based access control restricts recommendation endpoint strictly to mentees. |
| **14** | `GET /api/recommendations` as mentee with no profile | `400 Bad Request` | `400 Bad Request` with `{"message": "Please complete your profile first"}` | **Passed** | Halts recommendation flow if mentee profile is incomplete. |

---

## Key Observations & Test Verdict

1. **Authentication & Authorization**:
   - JWT tokens properly preserve user claims (`accountID`, `role`).
   - Role boundaries are strictly enforced: mentors cannot query the recommendation matching pipeline.

2. **NLP Child Process & Embeddings**:
   - `nlp/generate_embedding.py` and `nlp/recommend.py` successfully integrate with Express via standard input/output streams.
   - Embeddings conform to the expected 384-dimensional dense vector format (`all-MiniLM-L6-v2`).
   - 30-second timeout and Python command fallback (`python3` → `python` → virtual environment) ensure cross-platform resilience.

3. **Persistence Integrity**:
   - Quoted camelCase column identifiers (`"accountID"`, `"profileID"`, `"menteeID"`, `"mentorID"`, `"matchID"`, `"createdAt"`) match the PostgreSQL schema exactly.
   - Recommended top matches are reliably stored in the `matches` table with similarity scores rounded to 4 decimal places.
