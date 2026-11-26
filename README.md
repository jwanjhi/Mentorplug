# MentorPlug
An embedding-based semantic matching system for mentor-mentee recommendation.

**Student:** Wanjohi Joy Wambui | 159540 | ICS 4A
**Supervisor:** Mr. Daniel Machanje

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

## Significance testing
Paired tests comparing Sentence-BERT and TF-IDF on the same 20 mentee queries,
for P@1, P@3, P@5, MRR and Semantic Discrimination Margin. Reports the exact sign
test, Wilcoxon signed-rank, exact paired permutation test (with Holm-Bonferroni
correction across the five metrics) and a 95% bootstrap CI of the mean difference.

Requires `scipy`, `numpy` and `pandas` in `.venv` (`.venv/Scripts/pip install scipy numpy pandas`).

```bash
# 1. Export per-query P@5 (reruns the benchmark; fails if it does not reproduce
#    tests/sprint4_nlp_evaluation.json)
.venv/Scripts/python tests/export_per_query_p5.py
# 2. Build tests/per_query_results.csv from the stored per-query results
.venv/Scripts/python tests/build_per_query_results.py
# 3. Run the tests; writes tests/significance_results.csv
cd tests && ../.venv/Scripts/python significance_test.py per_query_results.csv
```

## Development Sprints
- Sprint 1: Environment setup, database schema, authentication
- Sprint 2: NLP pipeline — SBERT embedding and cosine similarity
- Sprint 3: Frontend and full recommendation flow
- Sprint 4: Evaluation, testing, and deployment