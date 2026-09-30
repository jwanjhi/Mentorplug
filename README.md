# MentorPlug
An embedding-based semantic matching system for mentor-mentee recommendation.

**Student:** Wanjohi Joy Wambui | 159540 | ICS 4A
**Supervisor:** Mr. Daniel Machanje
**University:** Strathmore University, Nairobi, Kenya

## Tech Stack
- Frontend: React.js
- Backend: Node.js + Express.js
- NLP: Python + Sentence-BERT (all-MiniLM-L6-v2)
- Database: PostgreSQL
- Deployment: Railway

## Project Structure

Mentorplug/
├── backend/ ← Node.js + Express REST API
├── frontend/ ← React.js user interface
├── nlp/ ← Python NLP pipeline (SBERT + TF-IDF)
├── data/ ← Cleaning script and dataset README only
├── tests/ ← pytest unit tests
└── README.md


## Dataset
Datasets are stored in Google Drive and are not committed to this repository.

## Setup Instructions

### Prerequisites
- Node.js LTS
- Python 3.11+
- PostgreSQL

### Backend
```bash
cd backend
node server.js
```

### Python NLP
```bash
pip install sentence-transformers scikit-learn spacy
python -m spacy download en_core_web_sm
```

### Database
```bash
# Create the database in PostgreSQL
createdb mentorplug
# Then run the schema file
psql -d mentorplug -f backend/config/schema.sql
```

## Development Sprints
- Sprint 1: Environment setup, database schema, authentication
- Sprint 2: NLP pipeline — SBERT embedding and cosine similarity
- Sprint 3: Frontend and full recommendation flow
- Sprint 4: Evaluation, testing, and deployment