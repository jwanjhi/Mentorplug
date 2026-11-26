"""
Export per-query P@5 for Sentence-BERT and TF-IDF.

nlp/evaluate_benchmark.py computes P@5 for every query but only writes the
macro average to tests/sprint4_nlp_evaluation.json. This script reruns the same
benchmark (importing its dataset loader, test profiles, models and metric code
unchanged) and writes the per-query P@5 values to tests/sprint4_per_query_p5.json.

As a reproducibility check it compares the rerun's per-query P@1, P@3, MRR and
Margin against the stored JSON, and P@5 against the stored macro averages, and
exits with an error if anything differs. The existing JSON is not modified.

RUN (from the project root):
    .venv/Scripts/python tests/export_per_query_p5.py
"""

import json
import math
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "nlp"))
os.chdir(ROOT)  # the benchmark loads data/ relative to the project root

import evaluate_benchmark as eb  # noqa: E402

STORED = ROOT / "tests" / "sprint4_nlp_evaluation.json"
OUT = ROOT / "tests" / "sprint4_per_query_p5.json"
CHECK = {"p1": "p@1", "p3": "p@3", "mrr": "rr", "margin": "margin"}
TOL = 1e-6  # allow for float noise in embeddings; precision values must match exactly anyway


def main():
    stored = json.loads(STORED.read_text(encoding="utf-8"))
    stored_by_id = {q["id"]: q for q in stored["per_query_comparison"]}

    mentors = eb.load_mentor_dataset(os.path.join("data", "mentor_profiles_clean.xlsx"))
    models = {"sbert": eb.SBERTRecommender(), "tfidf": eb.TFIDFRecommender()}
    for m in models.values():
        m.precompute_mentors(mentors)

    rows, mismatches = [], []
    for mentee in eb.TEST_MENTEE_PROFILES:
        row = {"id": mentee["id"]}
        for name, model in models.items():
            ranked, _ = model.rank(mentee["text"])
            metrics = eb.evaluate_ranking(ranked, mentee["relevant_categories"])
            row[f"{name}_p5"] = metrics["p@5"]
            for key, mkey in CHECK.items():
                old = stored_by_id[mentee["id"]][f"{name}_{key}"]
                if not math.isclose(old, metrics[mkey], abs_tol=TOL):
                    mismatches.append(f"query {mentee['id']} {name}_{key}: stored {old}, rerun {metrics[mkey]}")
        rows.append(row)

    for name in models:
        mean_p5 = sum(r[f"{name}_p5"] for r in rows) / len(rows)
        old = stored["macro_metrics"][name]["p@5"]
        if not math.isclose(old, mean_p5, abs_tol=TOL):
            mismatches.append(f"{name} macro P@5: stored {old}, rerun {mean_p5}")

    if mismatches:
        print("Rerun does not reproduce the stored evaluation; nothing written:")
        print("\n".join("  " + m for m in mismatches))
        sys.exit(1)

    OUT.write_text(json.dumps({"per_query_p5": rows}, indent=2), encoding="utf-8")
    print(f"Rerun matches stored results. Wrote per-query P@5 for {len(rows)} queries to {OUT}")


if __name__ == "__main__":
    main()
