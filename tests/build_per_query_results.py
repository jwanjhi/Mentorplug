"""
Build tests/per_query_results.csv for significance_test.py.

Writes one row per (query, metric) with the real per-query values for
Sentence-BERT and TF-IDF:
  - P@1, P@3, MRR, Margin  from tests/sprint4_nlp_evaluation.json
  - P@5                    from tests/sprint4_per_query_p5.json
                           (produced by tests/export_per_query_p5.py, because the
                           main evaluation JSON stores only the P@5 macro average)

RUN (from the project root):
    .venv/Scripts/python tests/build_per_query_results.py
"""

import csv
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "sprint4_nlp_evaluation.json"
P5_SRC = HERE / "sprint4_per_query_p5.json"
OUT = HERE / "per_query_results.csv"

# CSV metric name -> key suffix in the per-query records
METRICS = {"P@1": "p1", "P@3": "p3", "P@5": "p5", "MRR": "mrr", "Margin": "margin"}


def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    queries = data["per_query_comparison"]

    if not P5_SRC.exists():
        raise FileNotFoundError(f"{P5_SRC} not found; run tests/export_per_query_p5.py first")
    p5 = {r["id"]: r for r in json.loads(P5_SRC.read_text(encoding="utf-8"))["per_query_p5"]}
    if set(p5) != {q["id"] for q in queries}:
        raise ValueError("query ids in the P@5 file do not match the evaluation JSON")
    queries = [{**q, **p5[q["id"]]} for q in queries]

    rows = []
    for q in sorted(queries, key=lambda r: r["id"]):
        for metric, key in METRICS.items():
            sbert_key, tfidf_key = f"sbert_{key}", f"tfidf_{key}"
            if sbert_key not in q or tfidf_key not in q:
                raise KeyError(f"query {q['id']} is missing {sbert_key} or {tfidf_key}")
            rows.append([q["id"], metric, q[sbert_key], q[tfidf_key]])

    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["query_id", "metric", "sbert", "tfidf"])
        w.writerows(rows)

    print(f"Wrote {len(rows)} rows ({len(queries)} queries x {len(METRICS)} metrics) to {OUT}")


if __name__ == "__main__":
    main()
