"""
MentorPlug - NLP Mentor-Mentee Recommendation System
Script: nlp/generate_embedding.py

Generates dense vector embeddings for input text using the Sentence-BERT model
"all-MiniLM-L6-v2".

Usage:
    echo "Machine learning mentor with Python experience" | python nlp/generate_embedding.py

Input:
    Reads plain text string from standard input (stdin).

Output:
    Writes a JSON array of 384 floating-point numbers to stdout on success:
        [0.23, -0.81, 0.44, ...]
    Writes a JSON error object to stdout on failure:
        {"error": "error message"}
    Guarantees no extraneous logging, progress bars, or warnings appear on stdout.
"""

import sys
import os
import json
import warnings

# Suppress library warnings and noisy logging from HF/Transformers
warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"

_spacy_nlp = None


def preprocess_text(text: str) -> str:
    """
    Preprocesses input text using spaCy:
    - Loads the spaCy 'en_core_web_sm' model
    - Tokenises the input text
    - Removes stop words and punctuation
    - Lowercases all tokens
    - Joins clean tokens back into a string
    - Returns the cleaned string
    """
    global _spacy_nlp
    if _spacy_nlp is None:
        import spacy
        _spacy_nlp = spacy.load("en_core_web_sm")

    # Tokenise input text
    doc = _spacy_nlp(text)

    # Remove stop words and punctuation, lowercase all tokens
    clean_tokens = [
        token.text.lower()
        for token in doc
        if not token.is_stop and not token.is_punct and not token.is_space
    ]

    # Join clean tokens back into a string
    return " ".join(clean_tokens)


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

        # Why preprocessing improves embedding quality:
        # Removing punctuation and non-discriminative stop words while standardizing case
        # filters out syntactic noise. This allows the Sentence-BERT attention mechanism to
        # focus directly on semantically meaningful domain keywords (skills, interests, goals),
        # producing higher-quality embeddings and better similarity matching between mentors and mentees.
        cleaned_text = preprocess_text(text)

        # Fall back to raw stripped text if preprocessing leaves an empty string
        input_text = cleaned_text if cleaned_text.strip() else text.strip()

        # Import SentenceTransformer (deferred so imports don't block basic checks)
        from sentence_transformers import SentenceTransformer

        # Load "all-MiniLM-L6-v2" model (384-dimensional dense vectors)
        model = SentenceTransformer("all-MiniLM-L6-v2")

        # Generate embedding vector
        embedding = model.encode(
            input_text,
            convert_to_numpy=True,
            show_progress_bar=False
        )

        # Convert numpy array to standard Python list of floats
        embedding_list = [float(val) for val in embedding]

        # Prepare final JSON array output
        output_payload = json.dumps(embedding_list)

    except Exception as exc:
        # Format error output as JSON object
        output_payload = json.dumps({"error": str(exc)})

    finally:
        # Restore real stdout and print the final JSON payload
        sys.stdout = real_stdout
        sys.stdout.write(output_payload + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
