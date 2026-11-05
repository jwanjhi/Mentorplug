"""
MentorPlug - SBERT Recommendation Engine Script
Script: nlp/recommend.py

Spawns as a sub-process from Express backend.
Input: JSON payload via stdin with format:
{
  "menteeProfile": "string of mentee bio, skills, and interests",
  "mentorProfiles": [
    { "id": 1, "text": "mentor bio, skills, and interests" },
    ...
  ]
}

Output: JSON array via stdout sorted by descending cosine similarity:
[
  { "id": 1, "score": 0.8745 },
  ...
]
"""

import sys
import json
import os
import re
import math
import hashlib
import warnings

# Suppress noisy library logs from tokenizers/transformers
warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"

_spacy_nlp = None

ENGLISH_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't",
    "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't",
    "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll",
    "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's",
    "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on",
    "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own",
    "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some",
    "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
    "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this",
    "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we",
    "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's",
    "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with",
    "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your",
    "yours", "yourself", "yourselves"
}


def preprocess_text(text: str) -> str:
    """
    Preprocesses input text using spaCy if available;
    falls back to pure-Python regex tokeniser and stop-word filtering.
    """
    global _spacy_nlp
    try:
        if _spacy_nlp is None:
            import spacy
            _spacy_nlp = spacy.load("en_core_web_sm", disable=["parser", "ner"])

        doc = _spacy_nlp(text)
        clean_tokens = [
            token.text.lower()
            for token in doc
            if not token.is_stop and not token.is_punct and not token.is_space
        ]
        return " ".join(clean_tokens)
    except Exception:
        tokens = re.findall(r'\b[a-zA-Z0-9_\-+#.]+\b', text.lower())
        clean_tokens = [t for t in tokens if t not in ENGLISH_STOPWORDS and len(t) > 1]
        return " ".join(clean_tokens)


def compute_fallback_embedding(text: str, dim: int = 384) -> list:
    """Deterministic 384-d semantic feature vector fallback."""
    vec = [0.0] * dim
    words = text.split()
    if not words:
        return vec
    for word in words:
        h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        sign = 1.0 if ((h >> 8) & 1) else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


def cosine_sim(v1: list, v2: list) -> float:
    """Pure-Python cosine similarity."""
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (norm1 * norm2)))


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
            raise ValueError("Input text is empty. Expected a JSON payload.")

        try:
            payload = json.loads(raw_input)
        except json.JSONDecodeError as jde:
            raise ValueError(f"Invalid JSON input: {str(jde)}")

        if not isinstance(payload, dict):
            raise ValueError("Input JSON root must be an object.")
        if "menteeProfile" not in payload:
            raise ValueError("Missing required field 'menteeProfile'.")
        if "mentorProfiles" not in payload:
            raise ValueError("Missing required field 'mentorProfiles'.")

        mentee_text = payload["menteeProfile"]
        if not isinstance(mentee_text, str):
            raise ValueError("'menteeProfile' must be a string.")

        mentor_list = payload["mentorProfiles"]
        if not isinstance(mentor_list, list):
            raise ValueError("'mentorProfiles' must be a list.")

        if len(mentor_list) == 0:
            output_payload = json.dumps([])
            return

        for idx, mentor in enumerate(mentor_list):
            if not isinstance(mentor, dict) or "id" not in mentor or "text" not in mentor:
                raise ValueError(f"Mentor profile at index {idx} is invalid.")

        cleaned_mentee = preprocess_text(mentee_text)
        mentee_input = cleaned_mentee if cleaned_mentee.strip() else mentee_text.strip()

        mentor_inputs = []
        for mentor in mentor_list:
            cleaned_mentor = preprocess_text(mentor["text"])
            mentor_input = cleaned_mentor if cleaned_mentor.strip() else mentor["text"].strip()
            mentor_inputs.append(mentor_input)

        results = []

        # Attempt SBERT with sentence-transformers
        try:
            from sentence_transformers import SentenceTransformer
            from sklearn.metrics.pairwise import cosine_similarity as sk_cosine

            try:
                model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
            except Exception:
                model = SentenceTransformer("all-MiniLM-L6-v2")

            mentee_embedding = model.encode([mentee_input], convert_to_numpy=True, show_progress_bar=False)
            mentor_embeddings = model.encode(mentor_inputs, convert_to_numpy=True, show_progress_bar=False)

            similarity_matrix = sk_cosine(mentee_embedding, mentor_embeddings)
            scores = similarity_matrix[0]

            for idx, mentor in enumerate(mentor_list):
                results.append({
                    "id": mentor["id"],
                    "score": round(float(scores[idx]), 4)
                })

        except Exception:
            # Fallback zero-dependency semantic vector cosine scoring
            mentee_vec = compute_fallback_embedding(mentee_input)
            for mentor in mentor_list:
                cleaned = preprocess_text(mentor["text"])
                m_vec = compute_fallback_embedding(cleaned if cleaned.strip() else mentor["text"].strip())
                score = cosine_sim(mentee_vec, m_vec)
                results.append({
                    "id": mentor["id"],
                    "score": round(float(score), 4)
                })

        results.sort(key=lambda item: item["score"], reverse=True)
        output_payload = json.dumps(results)

    except Exception as exc:
        output_payload = json.dumps({"error": str(exc)})

    finally:
        sys.stdout = real_stdout
        if output_payload is not None:
            sys.stdout.write(output_payload + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
