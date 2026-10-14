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

        # Import SentenceTransformer (deferred so imports don't block basic checks)
        from sentence_transformers import SentenceTransformer

        # Load "all-MiniLM-L6-v2" model (384-dimensional dense vectors)
        model = SentenceTransformer("all-MiniLM-L6-v2")

        # Generate embedding vector
        embedding = model.encode(
            text.strip(),
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
