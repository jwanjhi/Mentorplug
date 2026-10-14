# Sprint II — Initial Evaluation Evidence

## Purpose
Compare SBERT semantic matching against TF-IDF baseline on the same 
mentor-mentee profiles to demonstrate semantic advantage.

## Test Profiles
**Mentee:** Recent CS graduate seeking guidance in fintech and 
backend development using Python and Node.js

**Mentor 1:** Software engineer with 8 years in financial technology 
and backend systems. Experienced in Python and system design.

**Mentor 2:** Mobile developer specialising in Android and iOS 
applications using Flutter and Dart.

**Mentor 3:** Data analyst with experience in financial modelling, 
SQL and business intelligence.

## Results

| Mentor | SBERT Score | TF-IDF Score |
|---|---|---|
| Mentor 1 | 0.6378 | 0.2312 |
| Mentor 2 | 0.1553 | 0.1795 |
| Mentor 3 | 0.1729 | 0.0788 |

## Key Observation
1. **Semantic Understanding vs. Exact Token Matching:** SBERT assigns Mentor 1 a significantly higher confidence score (**0.6378**) compared to TF-IDF (**0.2312**). SBERT's transformer-based attention mechanism recognizes the semantic equivalence between *"fintech"* and *"financial technology"*, as well as the deep alignment between *"backend development"* and *"backend systems / system design"*. In contrast, TF-IDF is restricted to exact surface token overlap and fails to capture domain synonymy.
2. **Discrimination Margin:** SBERT provides a wide discriminative margin of **0.4649** between the relevant match (Mentor 1: 0.6378) and the next closest candidate (Mentor 3: 0.1729), ensuring unambiguous recommendation ranking. With TF-IDF, the margin between Mentor 1 (0.2312) and the completely irrelevant Mentor 2 (0.1795, mobile developer) is only **0.0517**, demonstrating how bag-of-words approaches struggle to separate relevant from non-relevant candidates.
3. **Domain Affinity Ranking:** SBERT accurately identifies the financial domain affinity of Mentor 3 (*financial modelling*), ranking them above Mentor 2 (*mobile developer*). TF-IDF erroneously ranks the mobile developer higher due to coincidental vocabulary distribution.

## Conclusion
Full precision, recall and F1 evaluation will be completed in Sprint 4 
using the cleaned Resume Dataset (50 mentor profiles, 20 mentee profiles).
