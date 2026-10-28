"""
MentorPlug - Semantic CV Skill Extraction Pipeline
Script: nlp/extract_cv_skills.py

Extracts top technical skills and focus domains from raw CV text using
Sentence-BERT ("all-MiniLM-L6-v2") semantic embedding and cosine similarity.

Methodology (KeyBERT-style Semantic Ranking):
1. Candidate skill and domain keywords are defined across software engineering, AI/ML, cloud, and data.
2. The entire CV document is encoded into a 384-dimensional dense semantic vector.
3. Candidate skill phrases are encoded into 384-dimensional dense vectors.
4. Cosine similarity is computed between each candidate skill vector and the CV vector.
5. High-scoring semantic skills (confidence >= 0.40) and top ranked domain interests are returned.

Input (stdin JSON):
    { "cvText": "..." }

Output (stdout JSON):
    {
        "semanticSkills": ["Python", "Machine Learning", "PostgreSQL", ...],
        "suggestedInterests": ["Artificial Intelligence", "Backend Systems"],
        "topScores": {"Python": 0.742, "Machine Learning": 0.685}
    }
"""

import sys
import os
import json
import warnings
import numpy as np

# Suppress library warnings and noisy logging
warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"

# Candidate vocabulary of skills and domain categories
CANDIDATE_SKILLS = [
    "Python", "JavaScript", "TypeScript", "Node.js", "React", "Vue.js", "Angular",
    "Express.js", "Django", "Flask", "FastAPI", "Java", "Spring Boot", "C++", "C#",
    ".NET", "PHP", "Laravel", "Go", "Rust", "Ruby on Rails",
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQL", "Database Administration",
    "Docker", "Kubernetes", "AWS", "Azure", "Google Cloud", "Linux",
    "DevOps", "CI/CD", "Git", "System Design", "Microservices", "REST APIs", "GraphQL",
    "Machine Learning", "Deep Learning", "Data Science", "Natural Language Processing",
    "Computer Vision", "PyTorch", "TensorFlow", "Scikit-Learn", "Pandas", "NumPy",
    "Cybersecurity", "Network Security", "Penetration Testing", "Information Security",
    "Agile", "Scrum", "Fintech", "Financial Technology", "Blockchain",
    "UI/UX Design", "Figma", "Mobile Development", "Flutter", "React Native",
    "Android Development", "iOS Development", "Swift", "Kotlin",
    "Data Analysis", "Tableau", "Power BI", "Cloud Computing"
]

DOMAIN_INTERESTS_MAP = {
    "Artificial Intelligence & ML": ["Machine Learning", "Deep Learning", "Natural Language Processing", "Computer Vision", "PyTorch", "TensorFlow"],
    "Backend & System Architecture": ["Node.js", "Python", "Java", "Go", "Microservices", "System Design", "PostgreSQL", "REST APIs"],
    "Cloud & DevOps Infrastructure": ["AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "DevOps", "CI/CD", "Linux"],
    "Frontend & UI Engineering": ["React", "JavaScript", "TypeScript", "Vue.js", "Angular", "UI/UX Design", "Figma"],
    "Data Analytics & BI": ["Data Analysis", "Data Science", "SQL", "Pandas", "Tableau", "Power BI"],
    "Mobile Application Engineering": ["Mobile Development", "Flutter", "React Native", "Android Development", "iOS Development", "Swift", "Kotlin"],
    "Cybersecurity & Defense": ["Cybersecurity", "Network Security", "Penetration Testing", "Information Security"],
    "Financial Technology (Fintech)": ["Fintech", "Financial Technology", "Blockchain"]
}


def cosine_similarity(v1, v2):
    dot = np.dot(v1, v2)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot / (norm1 * norm2))


def main():
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    real_stdout = sys.stdout
    sys.stdout = sys.stderr

    output_payload = None

    try:
        raw_input = sys.stdin.read()
        if not raw_input or not raw_input.strip():
            raise ValueError("Input text is empty.")

        data = json.loads(raw_input)
        cv_text = data.get("cvText", "").strip()

        if not cv_text:
            raise ValueError("No cvText provided in JSON payload.")

        # Load SBERT model
        from sentence_transformers import SentenceTransformer
        try:
            model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
        except Exception:
            model = SentenceTransformer("all-MiniLM-L6-v2")

        # Encode CV document (truncate to 2000 chars for efficient dense representation)
        doc_embedding = model.encode(cv_text[:3000], convert_to_numpy=True, show_progress_bar=False)

        # Encode all candidate skills in one batch
        skill_embeddings = model.encode(CANDIDATE_SKILLS, convert_to_numpy=True, show_progress_bar=False)

        # Compute cosine similarity for each skill
        scored_skills = []
        for i, skill in enumerate(CANDIDATE_SKILLS):
            sim = cosine_similarity(doc_embedding, skill_embeddings[i])
            scored_skills.append((skill, round(sim, 4)))

        # Sort descending by similarity
        scored_skills.sort(key=lambda x: x[1], reverse=True)

        # Select top semantic skills with reasonable confidence (score >= 0.35)
        top_skills = [skill for skill, score in scored_skills if score >= 0.35][:10]
        if not top_skills:
            top_skills = [skill for skill, score in scored_skills[:5]]

        score_dict = {skill: score for skill, score in scored_skills[:12]}

        # Infer domain interests based on top skills
        inferred_domains = set()
        for domain, domain_skills in DOMAIN_INTERESTS_MAP.items():
            if any(s in top_skills for s in domain_skills):
                inferred_domains.add(domain)

        suggested_interests = list(inferred_domains)[:4]
        if not suggested_interests:
            suggested_interests = ["Software Development", "Career Mentorship"]

        output_payload = json.dumps({
            "semanticSkills": top_skills,
            "suggestedInterests": suggested_interests,
            "topScores": score_dict
        })

    except Exception as exc:
        output_payload = json.dumps({"error": str(exc)})

    finally:
        sys.stdout = real_stdout
        sys.stdout.write(output_payload + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
