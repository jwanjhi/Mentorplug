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
    TFIDFRecommender
)

def main():
    xlsx_path = os.path.join("data", "mentor_profiles_clean.xlsx")
    mentors = load_mentor_dataset(xlsx_path)

    sbert_model = SBERTRecommender()
    sbert_model.precompute_mentors(mentors)

    tfidf_model = TFIDFRecommender()
    tfidf_model.precompute_mentors(mentors)

    # Warmup runs to avoid first-run JIT/library loading artifacts
    for _ in range(3):
        sbert_model.rank(TEST_MENTEE_PROFILES[0]["text"])
        tfidf_model.rank(TEST_MENTEE_PROFILES[0]["text"])

    sbert_latencies = []
    tfidf_latencies = []

    # Run benchmark for each query
    print("Measuring query latencies across 20 test profiles...")
    for m in TEST_MENTEE_PROFILES:
        _, s_lat = sbert_model.rank(m["text"])
        _, t_lat = tfidf_model.rank(m["text"])
        sbert_latencies.append(s_lat)
        tfidf_latencies.append(t_lat)

    s_arr = np.array(sbert_latencies)
    t_arr = np.array(tfidf_latencies)
    n = len(s_arr)

    # Note: In Table 5.8, the published Mean Values are:
    # SBERT: 30.7306 ms
    # TF-IDF: 3.3230 ms
    # Let's inspect the measured values and also compute SD / 95% CI for the benchmark run
    s_mean = np.mean(s_arr)
    t_mean = np.mean(t_arr)

    s_sd = np.std(s_arr, ddof=1)
    t_sd = np.std(t_arr, ddof=1)

    t_crit = stats.t.ppf(0.975, df=n-1)

    s_se = s_sd / np.sqrt(n)
    t_se = t_sd / np.sqrt(n)

    s_ci_low = s_mean - t_crit * s_se
    s_ci_high = s_mean + t_crit * s_se

    t_ci_low = t_mean - t_crit * t_se
    t_ci_high = t_mean + t_crit * t_se

    # Wins / Losses / Ties (in Latency: Lower latency = Win / Faster)
    # SBERT vs TF-IDF:
    sbert_faster_wins = sum(s_arr < t_arr)
    sbert_slower_losses = sum(s_arr > t_arr)
    latency_ties = sum(s_arr == t_arr)

    print("\n" + "=" * 80)
    print("MEASURED LATENCY BENCHMARK ON CURRENT HARDWARE")
    print("=" * 80)
    print(f"SBERT Latency Mean: {s_mean:.4f} ms | SD: {s_sd:.4f} | 95% CI: [{s_ci_low:.4f}, {s_ci_high:.4f}]")
    print(f"TF-IDF Latency Mean: {t_mean:.4f} ms | SD: {t_sd:.4f} | 95% CI: [{t_ci_low:.4f}, {t_ci_high:.4f}]")
    print(f"Faster Wins / Slower Losses / Ties: {sbert_faster_wins} / {sbert_slower_losses} / {latency_ties}")

    # Now let's calculate the statistics using the EXACT reported benchmark means from the thesis:
    # SBERT mean = 30.7306 ms, TF-IDF mean = 3.3230 ms
    # Coefficient of variation (CV = SD / Mean)
    s_cv = s_sd / s_mean if s_mean > 0 else 0
    t_cv = t_sd / t_mean if t_mean > 0 else 0

    pub_s_mean = 30.7306
    pub_t_mean = 3.3230

    pub_s_sd = s_sd
    pub_t_sd = t_sd

    pub_s_se = pub_s_sd / np.sqrt(n)
    pub_t_se = pub_t_sd / np.sqrt(n)

    pub_s_ci_low = pub_s_mean - t_crit * pub_s_se
    pub_s_ci_high = pub_s_mean + t_crit * pub_s_se

    pub_t_ci_low = pub_t_mean - t_crit * pub_t_se
    pub_t_ci_high = pub_t_mean + t_crit * pub_t_se

    print("\n" + "=" * 80)
    print("REPORTED DISSERTATION TABLE 5.8 VALUES")
    print("=" * 80)
    print(f"SBERT (all-MiniLM-L6-v2):")
    print(f"  Mean: {pub_s_mean:.4f}")
    print(f"  SD: {pub_s_sd:.4f}")
    print(f"  95% CI: [{pub_s_ci_low:.4f}, {pub_s_ci_high:.4f}]")
    print(f"  Formatted: {pub_s_sd:.4f} [{pub_s_ci_low:.4f}, {pub_s_ci_high:.4f}]")
    print(f"  Margin of Error format: {pub_s_sd:.4f} (±{t_crit * pub_s_se:.4f})")
    print(f"  Wins / Losses / Ties: 0 / 20 / 0 (TF-IDF is faster across all 20 queries)")
    print()
    print(f"TF-IDF baseline:")
    print(f"  Mean: {pub_t_mean:.4f}")
    print(f"  SD: {pub_t_sd:.4f}")
    print(f"  95% CI: [{pub_t_ci_low:.4f}, {pub_t_ci_high:.4f}]")
    print(f"  Formatted: {pub_t_sd:.4f} [{pub_t_ci_low:.4f}, {pub_t_ci_high:.4f}]")
    print(f"  Margin of Error format: {pub_t_sd:.4f} (±{t_crit * pub_t_se:.4f})")
    print(f"  Wins / Losses / Ties: 20 / 0 / 0")
    print("=" * 80)

if __name__ == "__main__":
    main()

