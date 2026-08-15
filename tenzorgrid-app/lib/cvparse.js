// Zero-dependency CV text extraction + field guessing.
//
// There is no npm/pip package registry access in this app's build environment, so
// this is a hand-written, best-effort extractor rather than a battle-tested library
// like pdf-parse or mammoth. It handles the common case well (a normal, non-scanned,
// non-encrypted PDF or a modern .docx) and degrades gracefully — if extraction or
// guessing comes up empty, the onboarding form simply stays blank for the user to
// fill in manually, exactly like before this feature existed. Nothing breaks either way.

const zlib = require('node:zlib');
const { SKILLS } = require('./skills-data');
const ai = require('./ai');

const ROLE_TITLES = [
  'Senior Software Engineer', 'Staff Software Engineer', 'Principal Software Engineer',
  'Software Engineer', 'Staff Engineer', 'Software Developer',
  'Senior Frontend Engineer', 'Frontend Engineer', 'Full Stack Developer', 'Full Stack Engineer',
  'Frontend Developer', 'Senior Backend Engineer', 'Backend Engineer', 'Backend Developer',
  'Web Developer', 'Mobile Developer', 'iOS Developer', 'Android Developer',
  'DevOps Engineer', 'Site Reliability Engineer', 'Platform Engineer',
  'Data Engineer', 'Data Scientist', 'Data Analyst', 'Machine Learning Engineer',
  'AI Engineer', 'QA Engineer', 'Test Engineer', 'Product Manager', 'Product Owner',
  'Project Manager', 'Program Manager', 'Engineering Manager', 'Technical Lead',
  'Tech Lead', 'CTO', 'CEO', 'Founder', 'Co-Founder', 'UI Designer', 'UX Designer',
  'Product Designer', 'Graphic Designer', 'Business Analyst', 'Systems Analyst',
  'Marketing Manager', 'Digital Marketing Manager', 'Sales Manager', 'Account Manager',
  'Business Development Manager', 'HR Manager', 'Recruiter', 'Talent Acquisition Specialist',
  'Financial Analyst', 'Accountant', 'Operations Manager', 'Supply Chain Manager',
  'Customer Success Manager', 'Support Engineer', 'Solutions Architect', 'Cloud Architect',
  'Security Engineer', 'Network Engineer', 'Database Administrator', 'Intern',
];

// ---- ZIP (used for .docx, which is a ZIP container of XML parts) ----

function findEOCD(buffer) {
  const sig = 0x06054b50;
  const minPos = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minPos; i--) {
    if (buffer.readUInt32LE(i) === sig) return i;
  }
  return -1;
}

function unzipEntry(buffer, entryName) {
  const eocdOff = findEOCD(buffer);
  if (eocdOff === -1) return null;
  const cdEntries = buffer.readUInt16LE(eocdOff + 10);
  let offset = buffer.readUInt32LE(eocdOff + 16);
  for (let i = 0; i < cdEntries; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
    if (name === entryName) {
      const lNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
      const lExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
      const compData = buffer.slice(dataStart, dataStart + compSize);
      if (method === 0) return compData;
      if (method === 8) {
        try { return zlib.inflateRawSync(compData); } catch (e) { return null; }
      }
      return null;
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function docxBufferToText(buffer) {
  const xml = unzipEntry(buffer, 'word/document.xml');
  if (!xml) return '';
  let s = xml.toString('utf8');
  s = s.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

// ---- PDF (naive but effective for typical non-scanned, non-encrypted PDFs) ----

function decodePdfString(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      const n = s[i + 1];
      if (n === 'n') { out += '\n'; i++; }
      else if (n === 'r') { out += '\r'; i++; }
      else if (n === 't') { out += '\t'; i++; }
      else if (n === '(' || n === ')' || n === '\\') { out += n; i++; }
      else if (n >= '0' && n <= '7') {
        let oct = '';
        let j = i + 1;
        while (j < s.length && oct.length < 3 && s[j] >= '0' && s[j] <= '7') { oct += s[j]; j++; }
        out += String.fromCharCode(parseInt(oct, 8));
        i = j - 1;
      } else { out += n; i++; }
    } else {
      out += c;
    }
  }
  return out;
}

function pdfBufferToText(buffer) {
  const raw = buffer.toString('latin1');
  let text = '';
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = streamRe.exec(raw))) {
    const streamData = Buffer.from(m[1], 'latin1');
    let content;
    try {
      content = zlib.inflateSync(streamData).toString('latin1');
    } catch (e) {
      continue; // not Flate-compressed (image data, or already-plain) — skip
    }
    const tjRe = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
    let tm;
    while ((tm = tjRe.exec(content))) text += decodePdfString(tm[1]) + ' ';

    const tjArrRe = /\[((?:[^\[\]]|\\.)*)\]\s*TJ/g;
    let am;
    while ((am = tjArrRe.exec(content))) {
      const strRe = /\(((?:[^()\\]|\\.)*)\)/g;
      let sm;
      while ((sm = strRe.exec(am[1]))) text += decodePdfString(sm[1]);
      text += ' ';
    }
    text += '\n';
  }
  return text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ---- Heuristic field guessing (used when no AI key is configured, or as a floor) ----

function guessName(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8);
  for (const line of lines) {
    if (line.length > 3 && line.length < 40 && /^[A-Za-z][A-Za-z.'\- ]+$/.test(line) &&
        !/resume|curriculum|vitae|\bcv\b|profile|summary|objective/i.test(line)) {
      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) return line.replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}

function guessRole(text) {
  const lower = text.toLowerCase();
  let best = null;
  for (const title of ROLE_TITLES) {
    const idx = lower.indexOf(title.toLowerCase());
    if (idx !== -1 && (best === null || idx < best.idx)) best = { idx, title };
  }
  return best ? best.title : null;
}

function guessExperienceYears(text) {
  const direct = text.match(/(\d{1,2}(?:\.\d)?)\s*\+?\s*years?\s+(?:of\s+)?(?:professional\s+|work\s+)?experience/i);
  if (direct) return parseFloat(direct[1]);
  const years = [...text.matchAll(/\b(19[89]\d|20[0-3]\d)\b/g)].map((m) => parseInt(m[1], 10));
  if (years.length >= 2) {
    const span = Math.max(...years) - Math.min(...years);
    if (span > 0 && span < 45) return span;
  }
  return null;
}

function guessSkills(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const skill of SKILLS) {
    const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(^|[^a-z0-9])' + escaped + '([^a-z0-9]|$)', 'i');
    if (re.test(lower)) found.push(skill);
    if (found.length >= 25) break;
  }
  return found;
}

function heuristicExtract(text) {
  return {
    name: guessName(text),
    role: guessRole(text),
    experienceYears: guessExperienceYears(text),
    skills: guessSkills(text),
  };
}

async function aiExtract(text) {
  if (!ai.isAvailable()) return null;
  const prompt = `Extract structured resume data as strict JSON with exactly these keys: ` +
    `name (string or null), role (the person's most recent or current job title, string or null), ` +
    `experienceYears (number or null — total years of professional experience), ` +
    `skills (array of up to 20 short skill strings actually present in the resume — technical and ` +
    `professional skills only, no filler). Return ONLY the JSON object, nothing else.\n\n` +
    `Resume text:\n${text.slice(0, 6000)}`;
  try {
    const raw = await ai.callClaude({ prompt, maxTokens: 700 });
    const json = ai.extractJson(raw);
    if (!json) return null;
    return {
      name: typeof json.name === 'string' && json.name.trim() ? json.name.trim() : null,
      role: typeof json.role === 'string' && json.role.trim() ? json.role.trim() : null,
      experienceYears: typeof json.experienceYears === 'number' ? json.experienceYears : null,
      skills: Array.isArray(json.skills) ? json.skills.filter((s) => typeof s === 'string').slice(0, 20) : [],
    };
  } catch (e) {
    console.error('AI CV extraction failed, falling back to heuristics:', e.message);
    return null;
  }
}

async function extractFromCv(buffer, mime) {
  let text = '';
  try {
    if (mime === 'application/pdf') text = pdfBufferToText(buffer);
    else text = docxBufferToText(buffer); // .docx works well; legacy binary .doc will usually yield '' (fails gracefully)
  } catch (e) {
    console.error('CV text extraction failed:', e.message);
    text = '';
  }

  if (!text || text.replace(/\s/g, '').length < 30) {
    return { name: null, role: null, experienceYears: null, skills: [], source: 'none' };
  }

  const aiResult = await aiExtract(text);
  if (aiResult) return { ...aiResult, source: 'ai' };

  return { ...heuristicExtract(text), source: 'heuristic' };
}

module.exports = { extractFromCv, pdfBufferToText, docxBufferToText, heuristicExtract, guessSkills };
