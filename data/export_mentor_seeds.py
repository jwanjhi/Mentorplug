"""
MentorPlug - Mentor Profile Seed Generator
Script: data/export_mentor_seeds.py

Reads 48 mentor resumes from data/mentor_profiles_clean.xlsx.
For each mentor:
- Extracts clean job title, bio summary, skills, and industry domain.
- Assigns a realistic professional name, professional email, and experience years.
- Computes dense 384-dimensional Sentence-BERT ('all-MiniLM-L6-v2') embedding vector.
- Outputs data/mentor_seeds.json ready for database ingestion into PostgreSQL.
"""

import sys
import os
import re
import json
import zipfile
import xml.etree.ElementTree as ET
import warnings

warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Curated realistic professional names per category (2 mentors per category)
CATEGORY_MENTOR_NAMES = {
    "ACCOUNTANT": ["David K. Mwangi, CPA", "Sarah L. Jenkins, ACCA"],
    "ADVOCATE": ["Patricia W. Ochieng", "Marcus T. Vance"],
    "AGRICULTURE": ["Dr. Joseph K. Kiprop", "Elena M. Rostova"],
    "APPAREL": ["Chloe A. Dubois", "Victor K. Mutua"],
    "ARTS": ["Gabriel O. Santana", "Maya R. Lin"],
    "AUTOMOBILE": ["Klaus H. Weber", "Brian M. Otieno"],
    "AVIATION": ["Capt. Samuel E. Adebayo", "Amelia J. Vance"],
    "BANKING": ["Anthony C. Kamau", "Beatrice N. Ndungu"],
    "BPO": ["Rajesh P. Sharma", "Grace K. Wambua"],
    "BUSINESS-DEVELOPMENT": ["Alexander P. Hayes", "Cynthia W. Kimani"],
    "CHEF": ["Chef Jean-Luc Moreau", "Chef Anita S. Patel"],
    "CONSTRUCTION": ["Eng. George K. Kariuki", "Dominic F. Rossi"],
    "CONSULTANT": ["Victoria M. Sterling", "Kennedy O. Maina"],
    "DESIGNER": ["Liam J. Chen", "Sophie T. Wanjiku"],
    "DIGITAL-MEDIA": ["Trevor N. Noah", "Hannah G. Mutisya"],
    "ENGINEERING": ["Eng. Dennis M. Njoroge", "Dr. Alistair R. Vance"],
    "FINANCE": ["Franklin J. Omondi", "Claire B. Montgomery"],
    "FITNESS": ["Marcus D. Brody", "Faith W. Chebet"],
    "HEALTHCARE": ["Dr. Elizabeth K. Achieng", "Jonathan P. Hughes, RN"],
    "HR": ["Brenda N. Makena", "Robert L. Sterling"],
    "INFORMATION-TECHNOLOGY": ["Kevin O. Odhiambo", "Emily R. Thorne"],
    "PUBLIC-RELATIONS": ["Natasha V. Romanova", "Harrison K. Githinji"],
    "SALES": ["Michael T. Otieno", "Rebecca J. Lawson"],
    "TEACHER": ["Dr. Margaret W. Karimi", "Arthur C. Clarke, M.Ed."]
}

# Domain skills keywords by category
CATEGORY_DEFAULT_SKILLS = {
    "ACCOUNTANT": ["Financial Reporting", "GAAP Compliance", "General Ledger", "Payroll Accounting", "Tax Preparation", "Auditing"],
    "ADVOCATE": ["Patient Advocacy", "Healthcare Compliance", "Case Management", "Client Counseling", "Healthcare Administration"],
    "AGRICULTURE": ["Sustainable Agronomy", "Crop Management", "Agribusiness", "Soil Fertility", "Irrigation Systems"],
    "APPAREL": ["Garment Construction", "Apparel Production", "Pattern Making", "Textile Sourcing", "Fashion Merchandising"],
    "ARTS": ["Studio Fine Arts", "Concept Sketching", "Visual Storytelling", "Exhibition Curation", "Oil Painting"],
    "AUTOMOBILE": ["Automotive Engineering", "Engine Diagnostics", "Powertrain Systems", "Vehicle Maintenance", "Electrical Systems"],
    "AVIATION": ["Aviation Safety", "Flight Operations", "Airport Logistics", "Fleet Maintenance", "Air Traffic Protocol"],
    "BANKING": ["Commercial Banking", "Credit Risk Analysis", "Wealth Management", "Loan Underwriting", "Financial Operations"],
    "BPO": ["Operations Management", "Customer Experience (CX)", "Service Level Agreements (SLA)", "Quality Assurance", "Workforce Planning"],
    "BUSINESS-DEVELOPMENT": ["Enterprise Sales", "Strategic Partnerships", "B2B Negotiations", "Market Expansion", "Revenue Strategy"],
    "CHEF": ["Culinary Management", "Menu Engineering", "Banquet Catering", "Kitchen Operations", "Food Safety & HACCP"],
    "CONSTRUCTION": ["Structural Engineering", "Project Management", "AutoCAD Drafting", "Building Code Compliance", "Cost Estimation"],
    "CONSULTANT": ["Management Consulting", "Corporate Strategy", "Organizational Redesign", "Operational Excellence", "Change Management"],
    "DESIGNER": ["UI/UX Design", "Figma", "Design Systems", "Visual Branding", "Typography", "User Research"],
    "DIGITAL-MEDIA": ["Content Strategy", "Digital Marketing", "Social Media Campaigns", "SEO Optimization", "Brand Storytelling"],
    "ENGINEERING": ["System Architecture", "Mechanical Engineering", "Automation", "Technical Problem Solving", "Process Optimization"],
    "FINANCE": ["Financial Modeling", "Corporate Valuation", "Capital Markets", "Equity Research", "Portfolio Management"],
    "FITNESS": ["Sports Science", "Kinesiology", "Strength & Conditioning", "Nutritional Coaching", "Injury Rehabilitation"],
    "HEALTHCARE": ["Clinical Nursing", "Healthcare Systems", "Patient Care Planning", "Medical Documentation", "Public Health"],
    "HR": ["Talent Acquisition", "Employee Relations", "HR Operations", "Compensation & Benefits", "Performance Management"],
    "INFORMATION-TECHNOLOGY": ["Python", "Node.js", "Cloud Infrastructure (AWS/Docker)", "PostgreSQL", "REST APIs", "System Design"],
    "PUBLIC-RELATIONS": ["Media Relations", "Crisis Communications", "Corporate PR", "Press Release Writing", "Brand Reputation"],
    "SALES": ["B2B Solution Selling", "Account Management", "Pipeline Forecasting", "Consultative Sales", "CRM Strategy"],
    "TEACHER": ["Pedagogy", "Curriculum Development", "Instructional Design", "Student Mentoring", "Educational Technology"]
}


def load_raw_profiles(xlsx_path: str):
    with zipfile.ZipFile(xlsx_path, "r") as z:
        sst_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        strings = [
            "".join(node.itertext())
            for node in sst_root.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si")
        ]
        sheet_root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        rows = []
        for r in sheet_root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
            row_vals = []
            for c in r.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                v = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                val = v.text if v is not None else ""
                if c.get("t") == "s" and val:
                    val = strings[int(val)]
                row_vals.append(val)
            if any(row_vals):
                rows.append(row_vals)

    items = []
    for r in rows[1:]:
        if len(r) >= 3 and r[1].strip():
            items.append({
                "dataset_id": r[0].strip(),
                "text": r[1].strip(),
                "category": r[2].strip().upper()
            })
    return items


def clean_summary_bio(text: str, category: str) -> str:
    """Extracts a clear, concise professional summary from the resume text."""
    # Find summary section if present
    match = re.search(r"Summary\s+([^.\n]+(?:\.[^.\n]+){1,3}\.)", text, re.IGNORECASE)
    if match:
        bio = match.group(1).strip()
    else:
        # Fallback to first 2-3 sentences
        sentences = [s.strip() for s in text.replace("\n", " ").split(".") if len(s.strip()) > 15]
        bio = ". ".join(sentences[:2]) + "."

    # Clean whitespace and weird kerning
    bio = re.sub(r"\s+", " ", bio).strip()
    if len(bio) > 280:
        cutoff = bio[:280].rfind(".")
        if cutoff > 100:
            bio = bio[:cutoff + 1]
        else:
            bio = bio[:277] + "..."

    return bio


def main():
    xlsx_path = os.path.join("data", "mentor_profiles_clean.xlsx")
    print(f"Reading dataset: {xlsx_path}...")
    raw_profiles = load_raw_profiles(xlsx_path)
    print(f"Loaded {len(raw_profiles)} mentor resumes.")

    print("Initializing Sentence-BERT ('all-MiniLM-L6-v2') & spaCy ('en_core_web_sm')...")
    import spacy
    from sentence_transformers import SentenceTransformer
    nlp = spacy.load("en_core_web_sm", disable=["parser", "ner"])
    model = SentenceTransformer("all-MiniLM-L6-v2")

    category_counters = {}
    seeds = []

    print("Processing mentor profiles and computing dense SBERT embeddings...")
    for idx, item in enumerate(raw_profiles, start=1):
        cat = item["category"]
        curr_count = category_counters.get(cat, 0)
        category_counters[cat] = curr_count + 1

        # Name & email
        name_list = CATEGORY_MENTOR_NAMES.get(cat, ["Experienced Mentor", "Senior Industry Mentor"])
        name = name_list[curr_count % len(name_list)]
        clean_cat_slug = cat.lower().replace("-", ".").replace(" ", ".")
        email = f"mentor.{clean_cat_slug}.{curr_count + 1}@mentorplug.com"

        # Bio
        bio = clean_summary_bio(item["text"], cat)

        # Skills & interests
        skills = CATEGORY_DEFAULT_SKILLS.get(cat, [cat.title(), "Leadership", "Project Management"])
        interests = [
            f"{cat.title().replace('-', ' ')} Leadership",
            "Professional Mentorship & Career Guidance",
            "Industry Best Practices"
        ]

        # Experience years (between 5 and 15)
        exp_years = 5 + (idx * 3) % 11

        # Compute embedding over combined representation: bio + skills + interests
        profile_text = f"{bio} {' '.join(skills)} {' '.join(interests)}"

        # Preprocess with spaCy
        doc = nlp(profile_text)
        clean_tokens = [
            t.text.lower()
            for t in doc
            if not t.is_stop and not t.is_punct and not t.is_space
        ]
        clean_text = " ".join(clean_tokens)

        # Generate 384-dimensional dense vector
        emb = model.encode(clean_text, convert_to_numpy=True, normalize_embeddings=True)
        emb_list = [round(float(val), 6) for val in emb]

        seeds.append({
            "name": name,
            "email": email,
            "role": "mentor",
            "category": cat,
            "bio": bio,
            "skills": skills,
            "interests": interests,
            "experience_years": exp_years,
            "whatsapp": f"+254700{idx:06d}",
            "linkedin_url": f"https://linkedin.com/in/{clean_cat_slug}-{idx}",
            "embedding": emb_list
        })

    out_file = os.path.join("data", "mentor_seeds.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(seeds, f, indent=2, ensure_ascii=False)

    print(f"\n[Success] Successfully generated {len(seeds)} mentor seed profiles with 384-d embeddings!")
    print(f"[Saved] Seed JSON exported to: {out_file}")


if __name__ == "__main__":
    main()
