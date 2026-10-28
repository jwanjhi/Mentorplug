const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const pdfParseMod = require('pdf-parse');

/**
 * Universal PDF text extractor supporting both pdf-parse v1 (function) and v2 (PDFParse class).
 */
async function extractTextFromPdf(buffer) {
  if (typeof pdfParseMod === 'function') {
    const data = await pdfParseMod(buffer);
    return data.text || '';
  }
  if (pdfParseMod?.PDFParse) {
    const parser = new pdfParseMod.PDFParse({ data: buffer });
    try {
      const res = await parser.getText();
      return res.text || '';
    } finally {
      if (typeof parser.destroy === 'function') {
        try { await parser.destroy(); } catch (_) {}
      }
    }
  }
  if (typeof pdfParseMod?.default === 'function') {
    const data = await pdfParseMod.default(buffer);
    return data.text || '';
  }
  throw new Error('Unsupported pdf-parse module format');
}

// Curated comprehensive technical & domain skill vocabulary
const SKILL_TAXONOMY = [
  'Python', 'JavaScript', 'TypeScript', 'Node.js', 'React', 'Vue.js', 'Angular',
  'Express.js', 'Django', 'Flask', 'FastAPI', 'Java', 'Spring Boot', 'C++', 'C#',
  '.NET', 'PHP', 'Laravel', 'Go', 'Rust', 'Ruby', 'Ruby on Rails',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'SQL', 'Oracle',
  'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'GCP', 'Linux',
  'DevOps', 'CI/CD', 'Git', 'GitHub', 'GitLab', 'Terraform',
  'Machine Learning', 'Deep Learning', 'Data Science', 'NLP', 'Natural Language Processing',
  'Computer Vision', 'PyTorch', 'TensorFlow', 'Scikit-Learn', 'Pandas', 'NumPy',
  'Cybersecurity', 'Ethical Hacking', 'Penetration Testing', 'Network Security',
  'System Design', 'Microservices', 'GraphQL', 'REST APIs', 'Cloud Computing',
  'Agile', 'Scrum', 'Fintech', 'Blockchain', 'Smart Contracts',
  'UI/UX Design', 'Figma', 'Mobile Development', 'Flutter', 'React Native',
  'Android', 'iOS', 'Swift', 'Kotlin', 'Data Analysis', 'Tableau', 'Power BI'
];

/**
 * Executes Python SBERT script to rank semantic skills and domains via cosine similarity.
 */
const runSbertSkillExtractor = (rawText, timeoutMs = 30000) => {
  return new Promise((resolve) => {
    try {
      const scriptPath = path.resolve(__dirname, '../../nlp/extract_cv_skills.py');
      const venvPython = process.platform === 'win32'
        ? path.resolve(__dirname, '../../.venv/Scripts/python.exe')
        : path.resolve(__dirname, '../../.venv/bin/python');

      const candidates = [];
      if (process.env.PYTHON_PATH) candidates.push(process.env.PYTHON_PATH);
      if (fs.existsSync(venvPython)) candidates.push(venvPython);
      candidates.push(...(process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']));

      const pythonCmd = candidates[0] || 'python';
      const child = spawn(pythonCmd, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

      let stdout = '';
      let timer = setTimeout(() => {
        try { child.kill(); } catch (_) {}
        resolve(null);
      }, timeoutMs);

      child.stdout.on('data', (d) => { stdout += d.toString(); });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim());
            if (!parsed.error) return resolve(parsed);
          } catch (_) {}
        }
        resolve(null);
      });

      child.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });

      child.stdin.write(JSON.stringify({ cvText: rawText }));
      child.stdin.end();
    } catch (_) {
      resolve(null);
    }
  });
};

/**
 * Extracts skills from raw text using word boundary pattern matching.
 */
function extractSkills(text) {
  const detected = new Set();

  for (const skill of SKILL_TAXONOMY) {
    const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i');
    if (regex.test(text)) {
      detected.add(skill);
    }
  }

  return Array.from(detected);
}

/**
 * Cleans extracted bio text: collapses spaced letters, strips banner prefixes,
 * snaps to sentence boundaries, and strips trailing dangling prepositions/conjunctions.
 */
function cleanBioText(raw) {
  if (!raw) return '';

  let text = raw
    // Collapse single-letter spaced words like 'S o f t w a r e' -> 'Software'
    .replace(/(?:(?<=\s|^)[A-Za-z]\s+){2,}[A-Za-z](?=\s|$)/g, (m) => m.replace(/\s+/g, ''))
    // Normalize multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  // If there is a title banner like 'Software Engineering | AI & I am a...', strip prefix before narrative sentence
  const narrativeMatch = text.match(/\b(I\s+am|I\'m|A\s+[a-z\-]+\s+student|Passionate|Experienced|Dedicated|Results-driven)\b/i);
  if (narrativeMatch && narrativeMatch.index > 0 && narrativeMatch.index < 80) {
    const prefix = text.slice(0, narrativeMatch.index);
    if (/(\||&|•|\/|-)\s*$/.test(prefix.trim())) {
      text = text.slice(narrativeMatch.index).trim();
    }
  }

  // Snap to complete sentence
  const maxLen = 450;
  if (text.length > maxLen) {
    const truncated = text.slice(0, maxLen);
    const lastPeriod = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('.\n'),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('? ')
    );
    if (lastPeriod > 80) {
      text = truncated.slice(0, lastPeriod + 1).trim();
    } else {
      text = truncated;
    }
  }

  // Remove trailing dangling prepositions, conjunctions, symbols (e.g. "with hands-on experience in")
  const danglingRegex = /\b(and|with|in|to|for|of|at|by|on|or|as|the|a|an|&|,|-|\|)\s*$/i;
  while (danglingRegex.test(text)) {
    text = text.replace(danglingRegex, '').trim();
  }

  if (text && !/[.!?]$/.test(text)) {
    text += '.';
  }

  return text;
}

/**
 * Extracts a concise bio/professional summary from CV text.
 */
function extractSummary(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const summaryHeaderRegex = /^(professional\s+summary|executive\s+summary|profile\s+summary|summary|profile|about\s+me|career\s+objective|objective)$/i;
  const nextSectionRegex = /^(experience|work\s+experience|employment|education|skills|technical\s+skills|projects|certifications|awards)$/i;

  let inSummary = false;
  const summaryParagraphs = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (summaryHeaderRegex.test(line)) {
      inSummary = true;
      continue;
    }

    if (inSummary) {
      if (nextSectionRegex.test(line) || summaryParagraphs.join(' ').length > 450) {
        break;
      }
      summaryParagraphs.push(line);
    }
  }

  if (summaryParagraphs.length > 0) {
    const cleaned = cleanBioText(summaryParagraphs.join(' '));
    if (cleaned.length > 30) return cleaned;
  }

  const candidateLines = lines.filter((l) => {
    const isContact = /(@|github\.com|linkedin\.com|phone|\+254|\d{3}-\d{3}|nairobi|kenya|curriculum vitae|resume)/i.test(l);
    return !isContact && l.length > 35;
  });

  if (candidateLines.length > 0) {
    const cleaned = cleanBioText(candidateLines.slice(0, 3).join(' '));
    if (cleaned.length > 30) return cleaned;
  }

  return '';
}

/**
 * Estimates years of experience from year ranges or explicit mentions.
 */
function estimateExperienceYears(text) {
  const expMatch = text.match(/(\d+)\+?\s*years?(?:\s+of)?\s+experience/i);
  if (expMatch) {
    const yrs = parseInt(expMatch[1], 10);
    if (!isNaN(yrs) && yrs > 0 && yrs < 50) return yrs;
  }

  const yearMatches = [...text.matchAll(/\b(20\d{2})\s*(?:-|–|to)\s*(20\d{2}|present|current)\b/gi)];
  if (yearMatches.length > 0) {
    const currentYear = new Date().getFullYear();
    let minYear = currentYear;
    let maxYear = 2000;

    for (const m of yearMatches) {
      const start = parseInt(m[1], 10);
      const end = /present|current/i.test(m[2]) ? currentYear : parseInt(m[2], 10);
      if (!isNaN(start) && start < minYear) minYear = start;
      if (!isNaN(end) && end > maxYear) maxYear = end;
    }

    if (maxYear >= minYear && minYear !== currentYear) {
      const calculated = maxYear - minYear;
      return Math.min(Math.max(calculated, 1), 40);
    }
  }

  return 0;
}

/**
 * Derives smart interest topics from detected skills.
 */
function deriveInterests(skills) {
  const interests = new Set();
  const lowerSkills = skills.map((s) => s.toLowerCase());

  if (lowerSkills.some((s) => ['python', 'machine learning', 'deep learning', 'nlp', 'pytorch', 'tensorflow'].includes(s))) {
    interests.add('Artificial Intelligence & ML');
  }
  if (lowerSkills.some((s) => ['react', 'node.js', 'vue.js', 'angular', 'django', 'express.js', 'flask'].includes(s))) {
    interests.add('Backend & Full-Stack Development');
  }
  if (lowerSkills.some((s) => ['docker', 'kubernetes', 'aws', 'azure', 'devops', 'ci/cd'].includes(s))) {
    interests.add('Cloud & DevOps Infrastructure');
  }
  if (lowerSkills.some((s) => ['cybersecurity', 'network security', 'penetration testing'].includes(s))) {
    interests.add('Cybersecurity');
  }
  if (lowerSkills.some((s) => ['data science', 'sql', 'pandas', 'tableau', 'power bi'].includes(s))) {
    interests.add('Data Analytics & BI');
  }
  if (lowerSkills.some((s) => ['flutter', 'react native', 'android', 'ios', 'swift', 'kotlin'].includes(s))) {
    interests.add('Mobile App Development');
  }
  if (lowerSkills.some((s) => ['fintech', 'blockchain'].includes(s))) {
    interests.add('Financial Technology (Fintech)');
  }

  interests.add('Career Mentorship');
  return Array.from(interests).slice(0, 4);
}

/**
 * Main parser entry point: extracts text from PDF and enriches it using Sentence-BERT.
 */
async function parseCvBuffer(buffer) {
  const rawText = await extractTextFromPdf(buffer);

  if (!rawText.trim()) {
    throw new Error('Unable to extract text from the PDF. The file may be image-based or password-protected.');
  }

  // 1. Fast rule-based extraction
  const exactSkills = extractSkills(rawText);
  const bio = extractSummary(rawText);
  const experienceYears = estimateExperienceYears(rawText);
  const ruleInterests = deriveInterests(exactSkills);

  // 2. Sentence-BERT semantic extraction
  const sbertResult = await runSbertSkillExtractor(rawText);

  const combinedSkills = sbertResult?.semanticSkills && sbertResult.semanticSkills.length > 0
    ? [...new Set([...exactSkills, ...sbertResult.semanticSkills])]
    : exactSkills;

  const combinedInterests = sbertResult?.suggestedInterests && sbertResult.suggestedInterests.length > 0
    ? [...new Set([...ruleInterests, ...sbertResult.suggestedInterests])]
    : ruleInterests;

  return {
    bio: bio || (combinedSkills.length > 0 ? `Passionate technologist with experience in ${combinedSkills.slice(0, 4).join(', ')}.` : ''),
    skills: combinedSkills.slice(0, 10),
    interests: combinedInterests.slice(0, 4),
    experience_years: experienceYears,
    sbertConfidence: sbertResult?.topScores || null,
    textPreview: rawText.slice(0, 200).replace(/\s+/g, ' '),
  };
}

module.exports = {
  parseCvBuffer,
};
