"""
MentorPlug - NLP Mentor-Mentee Recommendation System
Script: nlp/recommend.py

Matches a mentee profile against candidate mentor profiles using semantic similarity:
1. Reads input JSON containing menteeProfile and mentorProfiles from standard input (stdin).
2. Cleans and normalizes all profile texts using spaCy (tokenization, stop word/punctuation removal, lowercasing).
3. Encodes normalized texts into dense vector embeddings using Sentence-BERT ("all-MiniLM-L6-v2").
4. Computes cosine similarity between mentee embedding and each mentor embedding using scikit-learn.
5. Returns a JSON array of mentor recommendations sorted by descending similarity score to stdout.

Input Format (stdin JSON):
    {
        "menteeProfile": "Aspiring data scientist interested in Python and machine learning.",
        "mentorProfiles": [
            {"id": 1, "text": "Senior ML Engineer with 5+ years in PyTorch and MLOps."},
            {"id": 2, "text": "Frontend React developer building web applications."}
        ]
    }

Output Format (stdout JSON):
    [
        {"id": 1, "score": 0.8412},
        {"id": 2, "score": 0.3125}
    ]

Error Format (stdout JSON):
    {"error": "error message"}
"""

import sys
import os
import json
import warnings

# Suppress warnings and library verbosity to keep standard streams clean
warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"

_spacy_nlp = None


def preprocess_text(text: str) -> str:
    """
    Preprocesses input text using spaCy:
    - Loads the spaCy 'en_core_web_sm' model (cached for performance)
    - Tokenises the input text
    - Removes stop words and punctuation
    - Lowercases all tokens
    - Joins clean tokens back into a single string
    - Returns the cleaned string
    """
    global _spacy_nlp
    if _spacy_nlp is None:
        import spacy
        _spacy_nlp = spacy.load("en_core_web_sm", disable=["parser", "ner"])

    # Tokenise input text
    doc = _spacy_nlp(text)

    # Filter out stop words, punctuation, and whitespace, then lowercase tokens
    clean_tokens = [
        token.text.lower()
        for token in doc
        if not token.is_stop and not token.is_punct and not token.is_space
    ]

    # Join cleaned tokens back into a string
    return " ".join(clean_tokens)


def main():
    # Step 1: Ensure standard I/O streams are configured for UTF-8
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    # Preserve the original stdout descriptor so ONLY final JSON reaches stdout
    real_stdout = sys.stdout
    # Route any library logs or debug prints to stderr
    sys.stdout = sys.stderr

    output_payload = None

    try:
        # Step 2: Read and parse input JSON from stdin
        raw_input = sys.stdin.read()
        if not raw_input or not raw_input.strip():
            raise ValueError("Input text is empty. Expected a JSON payload.")

        try:
            payload = json.loads(raw_input)
        except json.JSONDecodeError as jde:
            raise ValueError(f"Invalid JSON input: {str(jde)}")

        # Step 3: Validate input schema
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

        # If there are no mentors to match against, return an empty list immediately
        if len(mentor_list) == 0:
            output_payload = json.dumps([])
            return

        # Validate each mentor profile entry
        for idx, mentor in enumerate(mentor_list):
            if not isinstance(mentor, dict):
                raise ValueError(f"Mentor profile at index {idx} must be an object.")
            if "id" not in mentor:
                raise ValueError(f"Mentor profile at index {idx} is missing required 'id' field.")
            if "text" not in mentor or not isinstance(mentor["text"], str):
                raise ValueError(f"Mentor profile at index {idx} is missing valid string 'text' field.")

        # Step 4: Preprocess mentee and mentor texts using spaCy
        # Why preprocessing improves embedding quality:
        # Removing non-informative stopwords and punctuation while standardizing case
        # filters out syntactic noise. This focuses Sentence-BERT's attention mechanism
        # on core domain terms, skills, and goals for higher-quality semantic matching.
        cleaned_mentee = preprocess_text(mentee_text)
        # Fall back to raw text if stop word filtering removed all tokens
        mentee_input = cleaned_mentee if cleaned_mentee.strip() else mentee_text.strip()

        mentor_inputs = []
        for mentor in mentor_list:
            cleaned_mentor = preprocess_text(mentor["text"])
            mentor_input = cleaned_mentor if cleaned_mentor.strip() else mentor["text"].strip()
            mentor_inputs.append(mentor_input)

        # Step 5: Encode profiles using SentenceTransformer ("all-MiniLM-L6-v2")
        from sentence_transformers import SentenceTransformer
        try:
            model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
        except Exception:
            model = SentenceTransformer("all-MiniLM-L6-v2")

        # Generate dense embeddings for mentee and all mentors
        mentee_embedding = model.encode(
            [mentee_input],
            convert_to_numpy=True,
            show_progress_bar=False
        )

        mentor_embeddings = model.encode(
            mentor_inputs,
            convert_to_numpy=True,
            show_progress_bar=False
        )

        # Step 6: Compute cosine similarity between mentee and mentor embeddings
        from sklearn.metrics.pairwise import cosine_similarity
        similarity_matrix = cosine_similarity(mentee_embedding, mentor_embeddings)
        scores = similarity_matrix[0]  # First row corresponds to the single mentee profile

        # Step 7: Format results with mentor ID and similarity score
        results = []
        for idx, mentor in enumerate(mentor_list):
            results.append({
                "id": mentor["id"],
                "score": round(float(scores[idx]), 4)
            })

        # Step 8: Sort recommendations by descending similarity score
        results.sort(key=lambda item: item["score"], reverse=True)

        # Format final output as JSON
        output_payload = json.dumps(results)

    except Exception as exc:
        # Catch all errors and format as JSON error object
        output_payload = json.dumps({"error": str(exc)})

    finally:
        # Step 9: Restore real stdout and output only the final JSON payload
        sys.stdout = real_stdout
        if output_payload is not None:
            sys.stdout.write(output_payload + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
