# MentorPlug
An embedding-based semantic matching system for mentor-mentee recommendation.

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
├── data/ ← Evaluation dataset 
├── tests/ ← pytest unit tests
└── README.md


## Setup Instructions

### Prerequisites
- Node.js LTS
- Python 3.11+
- PostgreSQL

### Backend
```bash
cd backend
npm install
cp .env.example .env
node server.js
```

### Python NLP
```bash
pip install sentence-transformers scikit-learn spacy
python -m spacy download en_core_web_sm
```
