"""
MentorPlug - NLP Mentor-Mentee Recommendation System
Script: nlp/baseline_tfidf.py

Baseline Model for SBERT Comparison:
This script implements a traditional TF-IDF (Term Frequency-Inverse Document Frequency)
lexical baseline to compare against the dense semantic Sentence-BERT ("all-MiniLM-L6-v2") model.
While Sentence-BERT captures deep contextual semantics and domain synonyms (e.g., matching "fintech"
with "financial technology"), TF-IDF relies strictly on surface word frequency and exact token overlap.
Benchmarking SBERT against this TF-IDF baseline provides an empirical comparison of recommendation
quality between traditional sparse bag-of-words and modern deep transformer embeddings.

Input Format (stdin JSON):
    {
        "menteeProfile": "Recent computer science graduate seeking guidance in fintech and backend development",
        "mentorProfiles": [
            {"id": 1, "text": "Software engineer with 8 years in financial technology and backend systems"},
            {"id": 2, "text": "Mobile developer specialising in Android and iOS applications"}
        ]
    }

Output Format (stdout JSON):
    [
        {"id": 1, "score": 0.1415},
        {"id": 2, "score": 0.0703}
    ]

Error Format (stdout JSON):
    {"error": "error message"}
"""

import sys
import json
import warnings

# Suppress runtime warnings to ensure standard streams remain completely clean
warnings.filterwarnings("ignore")


def main():
    # Step 1: Configure UTF-8 encoding for standard I/O (especially on Windows)
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    # Preserve real stdout so that ONLY the final JSON payload is output
    real_stdout = sys.stdout
    # Route any intermediate logs or library stderr to sys.stderr
    sys.stdout = sys.stderr

    output_payload = None

    try:
        # Step 2: Read raw JSON input from standard input
        raw_input = sys.stdin.read()
        if not raw_input or not raw_input.strip():
            raise ValueError("Input text is empty. Expected a JSON payload.")

        try:
            payload = json.loads(raw_input)
        except json.JSONDecodeError as jde:
            raise ValueError(f"Invalid JSON input: {str(jde)}")

        # Step 3: Validate input schema (must match recommend.py structure)
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

        # If no mentors provided, return an empty recommendation list immediately
        if len(mentor_list) == 0:
            output_payload = json.dumps([])
            return

        # Validate each mentor entry
        for idx, mentor in enumerate(mentor_list):
            if not isinstance(mentor, dict):
                raise ValueError(f"Mentor profile at index {idx} must be an object.")
            if "id" not in mentor:
                raise ValueError(f"Mentor profile at index {idx} is missing required 'id' field.")
            if "text" not in mentor or not isinstance(mentor["text"], str):
                raise ValueError(f"Mentor profile at index {idx} is missing valid string 'text' field.")

        # Step 4: Prepare text corpus for joint TF-IDF vectorisation
        # Note: No spaCy preprocessing is needed here because scikit-learn's
        # TfidfVectorizer handles tokenisation, lowercasing, and vocabulary extraction internally.
        all_texts = [mentee_text] + [mentor["text"] for mentor in mentor_list]

        # Step 5: Fit and transform all texts together with TfidfVectorizer
        from sklearn.feature_extraction.text import TfidfVectorizer
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(all_texts)

        # Slice the sparse matrix: first row is mentee, remaining rows are mentors
        mentee_vector = tfidf_matrix[0:1]
        mentor_vectors = tfidf_matrix[1:]

        # Step 6: Compute cosine similarity between mentee vector and each mentor vector
        from sklearn.metrics.pairwise import cosine_similarity
        similarity_matrix = cosine_similarity(mentee_vector, mentor_vectors)
        scores = similarity_matrix[0]

        # Step 7: Build result objects with ID and similarity score
        results = []
        for idx, mentor in enumerate(mentor_list):
            results.append({
                "id": mentor["id"],
                "score": round(float(scores[idx]), 4)
            })

        # Step 8: Sort results in descending order of similarity score
        results.sort(key=lambda item: item["score"], reverse=True)

        # Format final payload as JSON string
        output_payload = json.dumps(results)

    except Exception as exc:
        # Catch any unexpected errors and write a JSON error response
        output_payload = json.dumps({"error": str(exc)})

    finally:
        # Step 9: Restore real stdout and print strictly the final JSON payload
        sys.stdout = real_stdout
        if output_payload is not None:
            sys.stdout.write(output_payload + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
