"""
Paired significance tests: Sentence-BERT vs TF-IDF on the same 20 mentee queries.

INPUT: a CSV called per_query_results.csv (same folder) with one row per query and metric:

    query_id,metric,sbert,tfidf
    1,P@1,1,1
    1,P@3,0.6667,0.3333
    1,P@5,0.4,0.4
    1,MRR,1,1
    1,Margin,0.0739,-0.0216
    2,P@1,0,0
    ...

The per-query values should already be in tests/sprint4_nlp_evaluation.json
(the tables report per-query SDs and wins/losses, so the script that made them
had them). Export them into the CSV above.

RUN:
    pip install scipy pandas numpy
    python significance_test.py

OUTPUT: printed table + significance_results.csv
"""

import sys
import numpy as np
import pandas as pd
from scipy import stats

CSV_PATH = sys.argv[1] if len(sys.argv) > 1 else "per_query_results.csv"
SEED = 42                # fixed so the bootstrap CI is reproducible
N_BOOT = 10_000
METRIC_ORDER = ["P@1", "P@3", "P@5", "MRR", "Margin"]


def exact_sign_test(diff):
    """Two-sided exact sign test: counts wins vs losses, ignores ties."""
    wins = int((diff > 0).sum())
    losses = int((diff < 0).sum())
    n = wins + losses
    if n == 0:
        return wins, losses, 1.0
    p = stats.binomtest(wins, n, 0.5, alternative="two-sided").pvalue
    return wins, losses, p


def paired_permutation_test(a, b):
    """Exact paired randomisation test on the mean difference
    (recommended for IR evaluation by Smucker et al., 2007).
    With 20 queries all 2^20 sign flips are enumerated, so the p-value is exact."""
    res = stats.permutation_test(
        (a, b),
        statistic=lambda x, y: np.mean(x - y),
        permutation_type="samples",
        alternative="two-sided",
        n_resamples=np.inf,
    )
    return res.pvalue


def wilcoxon_test(diff):
    """Wilcoxon signed-rank test; zero differences (ties) are dropped."""
    nonzero = diff[diff != 0]
    if len(nonzero) == 0:
        return 1.0
    return stats.wilcoxon(nonzero, alternative="two-sided").pvalue


def bootstrap_ci(diff, rng):
    """95% percentile bootstrap CI for the mean paired difference."""
    idx = rng.integers(0, len(diff), size=(N_BOOT, len(diff)))
    means = diff[idx].mean(axis=1)
    return np.percentile(means, [2.5, 97.5])


def holm(pvals):
    """Holm-Bonferroni adjustment across the metrics tested."""
    p = np.asarray(pvals)
    order = np.argsort(p)
    m = len(p)
    adj = np.empty(m)
    running = 0.0
    for rank, i in enumerate(order):
        running = max(running, (m - rank) * p[i])
        adj[i] = min(1.0, running)
    return adj


def main():
    df = pd.read_csv(CSV_PATH)
    rng = np.random.default_rng(SEED)
    rows = []
    for metric in [m for m in METRIC_ORDER if m in set(df["metric"])]:
        d = df[df["metric"] == metric].sort_values("query_id")
        a = d["sbert"].to_numpy(float)
        b = d["tfidf"].to_numpy(float)
        diff = a - b
        wins, losses, p_sign = exact_sign_test(diff)
        lo, hi = bootstrap_ci(diff, rng)
        rows.append({
            "Metric": metric,
            "n": len(diff),
            "SBERT mean": a.mean(),
            "TF-IDF mean": b.mean(),
            "Mean diff": diff.mean(),
            "95% CI of diff": f"[{lo:.3f}, {hi:.3f}]",
            "W/L/T": f"{wins}/{losses}/{len(diff) - wins - losses}",
            "p (sign)": p_sign,
            "p (Wilcoxon)": wilcoxon_test(diff),
            "p (permutation)": paired_permutation_test(a, b),
        })
    out = pd.DataFrame(rows)
    out["p (perm, Holm)"] = holm(out["p (permutation)"])
    pd.set_option("display.width", 200)
    print(out.to_string(index=False, float_format=lambda x: f"{x:.4f}"))
    out.to_csv("significance_results.csv", index=False)
    print("\nSaved significance_results.csv")


if __name__ == "__main__":
    main()
