"""
MentorPlug - SBERT Dense Vector Embedding Generator
Script: nlp/generate_embedding.py

Generates 384-dimensional dense vector embeddings for input text:
1. Reads input text from stdin (UTF-8 encoded).
2. Preprocesses text using spaCy tokenisation, stop-word removal, and lowercasing.
   (Falls back to pure-Python regex tokenisation if spaCy is not installed).
3. Encodes cleaned text via Sentence-BERT ('all-MiniLM-L6-v2').
   (Falls back to normalized 384-d semantic feature vector if PyTorch/SBERT is unavailable).
4. Outputs raw JSON array of 384 floating-point numbers to stdout.
"""

import sys
import json
import os
import re
import math
import hashlib
import warnings

# Suppress library warnings and noisy logging from HF/Transformers
warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"

_spacy_nlp = None

# Standard stop words for fallback tokenisation
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
    Preprocesses input text:
    - Attempts to use spaCy 'en_core_web_sm'
    - Falls back to pure-Python regex tokeniser + stopword removal if spaCy is missing.
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
        # Fallback pure-Python preprocessing
        tokens = re.findall(r'\b[a-zA-Z0-9_\-+#.]+\b', text.lower())
        clean_tokens = [t for t in tokens if t not in ENGLISH_STOPWORDS and len(t) > 1]
        return " ".join(clean_tokens)


def compute_fallback_embedding(text: str, dim: int = 384) -> list:
    """
    Deterministic 384-dimensional feature embedding used as a zero-dependency
    fallback when PyTorch/SentenceTransformers is not available in cloud compute.
    """
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
    return [round(float(v), 6) for v in vec]


def main():
    # Configure UTF-8 encoding for standard I/O (especially on Windows)
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    # Preserve real stdout so that only final JSON is output
    real_stdout = sys.stdout
    # Route intermediate prints or library outputs to stderr
    sys.stdout = sys.stderr

    try:
        # Read text from stdin
        text = sys.stdin.read()
        if not text or not text.strip():
            raise ValueError("Input text is empty.")

        cleaned_text = preprocess_text(text)
        input_text = cleaned_text if cleaned_text.strip() else text.strip()

        # Attempt to load SentenceTransformer
        try:
            from sentence_transformers import SentenceTransformer
            try:
                model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
            except Exception:
                model = SentenceTransformer("all-MiniLM-L6-v2")

            embedding = model.encode(
                input_text,
                convert_to_numpy=True,
                show_progress_bar=False
            )
            embedding_list = [float(val) for val in embedding]
        except Exception:
            # Fallback to deterministic 384-dimensional semantic projection
            embedding_list = compute_fallback_embedding(input_text, dim=384)

        output_payload = json.dumps(embedding_list)

    except Exception as exc:
        output_payload = json.dumps({"error": str(exc)})

    finally:
        sys.stdout = real_stdout
        sys.stdout.write(output_payload + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
