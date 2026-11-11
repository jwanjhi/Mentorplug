import os
import sys

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"

import numpy as np
import scipy.stats as stats

sys.path.insert(0, os.path.abspath("."))
from nlp.evaluate_benchmark import (
    load_mentor_dataset,
    TEST_MENTEE_PROFILES,
    SBERTRecommender,
    TFIDFRecommender,
    evaluate_ranking
)

def main():
    xlsx_path = os.path.join("data", "mentor_profiles_clean.xlsx")
    mentors = load_mentor_dataset(xlsx_path)

    sbert_model = SBERTRecommender()
    sbert_model.precompute_mentors(mentors)

    tfidf_model = TFIDFRecommender()
    tfidf_model.precompute_mentors(mentors)

    sbert_p5 = []
    tfidf_p5 = []

    print("Query-by-query Precision@5 Breakdown:")
    print(f"{'ID':<4} | {'Mentee Profile':<38} | {'SBERT P@5':<10} | {'TF-IDF P@5':<10} | {'Outcome':<8}")
    print("-" * 80)

    wins = 0
    losses = 0
    ties = 0

    for m in TEST_MENTEE_PROFILES:
        s_ranked, _ = sbert_model.rank(m["text"])
        t_ranked, _ = tfidf_model.rank(m["text"])

        s_eval = evaluate_ranking(s_ranked, m["relevant_categories"])
        t_eval = evaluate_ranking(t_ranked, m["relevant_categories"])

        sp5 = s_eval["p@5"]
        tp5 = t_eval["p@5"]

        sbert_p5.append(sp5)
        tfidf_p5.append(tp5)

        if sp5 > tp5:
            outcome = "Win"
            wins += 1
        elif sp5 < tp5:
            outcome = "Loss"
            losses += 1
        else:
            outcome = "Tie"
            ties += 1

        print(f"{m['id']:<4} | {m['title']:<38} | {sp5:<10.4f} | {tp5:<10.4f} | {outcome:<8}")

    sbert_p5 = np.array(sbert_p5)
    tfidf_p5 = np.array(tfidf_p5)
    n = len(sbert_p5)

    # Descriptive statistics
    s_mean = np.mean(sbert_p5)
    t_mean = np.mean(tfidf_p5)

    s_sd = np.std(sbert_p5, ddof=1)
    t_sd = np.std(tfidf_p5, ddof=1)

    s_se = s_sd / np.sqrt(n)
    t_se = t_sd / np.sqrt(n)

    t_crit = stats.t.ppf(0.975, df=n-1)

    s_ci_low = s_mean - t_crit * s_se
    s_ci_high = s_mean + t_crit * s_se

    t_ci_low = t_mean - t_crit * t_se
    t_ci_high = t_mean + t_crit * t_se

    diff = sbert_p5 - tfidf_p5
    paired_t, p_val = stats.ttest_rel(sbert_p5, tfidf_p5)

    print("\n" + "=" * 80)
    print("TABLE 5.5 VALUES COMPUTATION")
    print("=" * 80)
    print(f"Sample Size (Queries): {n}")
    print()
    print("--- SBERT (all-MiniLM-L6-v2) ---")
    print(f"Mean P@5: {s_mean:.4f}")
    print(f"Sample SD (ddof=1): {s_sd:.4f}")
    print(f"Standard Error (SE): {s_se:.4f}")
    print(f"95% CI (t-dist, df={n-1}): [{s_ci_low:.4f}, {s_ci_high:.4f}]")
    print(f"Formatted SD (95% CI): {s_sd:.4f} [{s_ci_low:.4f}, {s_ci_high:.4f}]")
    print(f"Alternative Format: {s_sd:.4f} (±{t_crit * s_se:.4f})")
    print(f"Wins / Losses / Ties: {wins} / {losses} / {ties}")
    print()
    print("--- TF-IDF Baseline ---")
    print(f"Mean P@5: {t_mean:.4f}")
    print(f"Sample SD (ddof=1): {t_sd:.4f}")
    print(f"Standard Error (SE): {t_se:.4f}")
    print(f"95% CI (t-dist, df={n-1}): [{t_ci_low:.4f}, {t_ci_high:.4f}]")
    print(f"Formatted SD (95% CI): {t_sd:.4f} [{t_ci_low:.4f}, {t_ci_high:.4f}]")
    print(f"Alternative Format: {t_sd:.4f} (±{t_crit * t_se:.4f})")
    print(f"Wins / Losses / Ties (TF-IDF vs SBERT): {losses} / {wins} / {ties}")
    print()
    print(f"Paired t-test: t = {paired_t:.4f}, p = {p_val:.4f}")
    print("=" * 80)

if __name__ == "__main__":
    main()
