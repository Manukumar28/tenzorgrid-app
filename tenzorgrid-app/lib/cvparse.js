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
  'Financial Analyst', 'Accountant', 'Senior Accountant', 'Staff Accountant', 'Accounts Receivable Specialist',
  'Accounts Payable Specialist', 'Bookkeeper', 'Payroll Specialist', 'Auditor', 'Internal Auditor',
  'Tax Consultant', 'Finance Manager', 'Controller', 'CFO',
  'Operations Manager', 'Supply Chain Manager', 'Logistics Coordinator', 'Warehouse Manager',
  'Customer Success Manager', 'Customer Service Representative', 'Customer Support Executive',
  'Support Engineer', 'Solutions Architect', 'Cloud Architect',
  'Security Engineer', 'Network Engineer', 'Database Administrator', 'Intern',
  'Registered Nurse', 'Staff Nurse', 'Medical Assistant', 'Pharmacist', 'Physician',
  'Healthcare Administrator', 'Medical Billing Specialist', 'Clinical Coordinator',
  'Paralegal', 'Legal Associate', 'Legal Counsel', 'Compliance Officer', 'Attorney',
  'Teacher', 'Lecturer', 'Professor', 'Academic Coordinator', 'Trainer', 'Instructional Designer',
  'Retail Associate', 'Store Manager', 'Cashier', 'Front Desk Executive', 'Receptionist',
  'Hotel Manager', 'Event Coordinator', 'Office Administrator', 'Administrative Assistant',
  'Executive Assistant', 'Data Entry Operator',
  'Production Manager', 'Quality Control Inspector', 'Machine Operator', 'Site Engineer',
  'Civil Engineer', 'Mechanical Engineer', 'Electrical Engineer', 'Construction Manager',
  'Content Writer', 'Copywriter', 'Editor', 'Journalist', 'Public Relations Manager',
  'Social Media Manager', 'Video Editor', 'Photographer',
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

// Many real-world PDFs (Word "Save as PDF", LibreOffice, Canva, etc.) embed subset
// fonts keyed by CID, where text is drawn with hex strings ("<...>  Tj") whose bytes
// are glyph codes, NOT character codes — decoding them as Latin1 produces garbage.
// The actual character is only recoverable via that font's embedded ToUnicode CMap
// (a small lookup table also stored as a PDF stream, mapping glyph code -> Unicode).
// This scans the whole document for every such CMap and merges them into one lookup
// table. It's an approximation (not scoped per-font), but works well in practice
// because most single-font-family resumes only have one relevant CMap in play.
function parseToUnicodeCMaps(rawLatin1Pdf) {
  const map = new Map();
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = streamRe.exec(rawLatin1Pdf))) {
    const buf = Buffer.from(m[1], 'latin1');
    let content;
    try {
      content = zlib.inflateSync(buf).toString('latin1');
    } catch (e) {
      content = buf.toString('latin1'); // CMap streams aren't always compressed
    }
    if (!content.includes('beginbfchar') && !content.includes('beginbfrange')) continue;

    const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
    let cm;
    while ((cm = bfcharRe.exec(content))) {
      const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
      let pm;
      while ((pm = pairRe.exec(cm[1]))) map.set(pm[1].toUpperCase().padStart(4, '0'), hexToUnicode(pm[2]));
    }

    const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
    let rm;
    while ((rm = bfrangeRe.exec(content))) {
      const rangeRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[[^\]]*\]|<[0-9A-Fa-f]+>)/g;
      let one;
      while ((one = rangeRe.exec(rm[1]))) {
        const width = one[1].length;
        const start = parseInt(one[1], 16);
        const end = parseInt(one[2], 16);
        if (end - start > 5000) continue; // guard against a runaway/corrupt range
        const dst = one[3];
        if (dst.startsWith('[')) {
          const arr = [...dst.matchAll(/<([0-9A-Fa-f]+)>/g)].map((x) => x[1]);
          for (let i = start; i <= end && (i - start) < arr.length; i++) {
            map.set(i.toString(16).toUpperCase().padStart(width, '0'), hexToUnicode(arr[i - start]));
          }
        } else {
          const dstHex = dst.replace(/[<>]/g, '');
          const dstStart = parseInt(dstHex, 16);
          for (let i = start; i <= end; i++) {
            map.set(
              i.toString(16).toUpperCase().padStart(width, '0'),
              hexToUnicode((dstStart + (i - start)).toString(16).padStart(dstHex.length, '0'))
            );
          }
        }
      }
    }
  }
  return map;
}

function hexToUnicode(hex) {
  if (hex.length % 4 !== 0) hex = hex.padStart(hex.length + (4 - (hex.length % 4)), '0');
  let out = '';
  for (let i = 0; i < hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return out;
}

// Decode a hex string run from a Tj/TJ operator. Tries 2-byte (CID/Identity-H) codes
// against the document's ToUnicode map first, since that's the common case for
// generated PDFs with embedded fonts; falls back to 1-byte codes (simple fonts using
// a hex string instead of a literal string, which also happens) if the CMap lookup
// mostly misses.
function decodeHexRun(hex, cmap) {
  hex = hex.replace(/\s+/g, '');
  if (hex.length % 2 !== 0) hex += '0';
  if (cmap && cmap.size) {
    let out2 = '';
    let hit2 = 0;
    let total2 = 0;
    for (let i = 0; i + 4 <= hex.length; i += 4) {
      const code = hex.slice(i, i + 4).toUpperCase();
      total2++;
      if (cmap.has(code)) { out2 += cmap.get(code); hit2++; }
    }
    if (total2 > 0 && hit2 / total2 > 0.4) return out2;
  }
  let out1 = '';
  for (let i = 0; i + 2 <= hex.length; i += 2) out1 += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return out1;
}

// Single-pass, order-preserving operator scan for one content stream. Real PDFs almost
// always draw one visual line per Tj/TJ call, moving the text cursor between lines with
// Td/TD (relative move) or T* (next line, using the leading set by TL) — they do NOT
// embed literal newline bytes in the string data. A naive extractor that just
// concatenates every Tj/TJ's text with spaces collapses the whole page into one run-on
// line, which silently breaks any line-oriented heuristic (name detection, section
// splitting for work history) even though substring-based matching (skills) still works
// fine — that mismatch is exactly what the "skills matched but name/role didn't" bug
// report looked like. This tracks line-break operators and inserts '\n' at the right
// points instead of flattening everything with spaces.
const PDF_OP_RE = /(-?[\d.]+)\s+(-?[\d.]+)\s+(Td|TD)|(T\*)|\(((?:[^()\\]|\\.)*)\)\s*Tj|<([0-9A-Fa-f\s]+)>\s*Tj|\[((?:[^\[\]])*)\]\s*TJ/g;

function contentStreamToText(content, cmap) {
  let out = '';
  let pendingBreak = false;
  let m;
  PDF_OP_RE.lastIndex = 0;
  while ((m = PDF_OP_RE.exec(content))) {
    const [, , tdy, tdop, tstar, lit, hex, arr] = m;
    if (tdop) {
      if (Math.abs(parseFloat(tdy)) > 0.01) pendingBreak = true;
      continue;
    }
    if (tstar) { pendingBreak = true; continue; }

    let piece = '';
    if (lit !== undefined) {
      piece = decodePdfString(lit);
    } else if (hex !== undefined) {
      piece = decodeHexRun(hex, cmap);
    } else if (arr !== undefined) {
      const pieceRe = /\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f\s]+)>/g;
      let pm;
      while ((pm = pieceRe.exec(arr))) {
        if (pm[1] !== undefined) piece += decodePdfString(pm[1]);
        else if (pm[2] !== undefined) piece += decodeHexRun(pm[2], cmap);
      }
    }
    if (!piece) continue;

    if (pendingBreak) {
      out += '\n' + piece;
    } else if (out && !/[\s\n]$/.test(out)) {
      out += ' ' + piece;
    } else {
      out += piece;
    }
    pendingBreak = false;
  }
  return out;
}

function pdfBufferToText(buffer) {
  const raw = buffer.toString('latin1');
  const cmap = parseToUnicodeCMaps(raw);
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
    text += contentStreamToText(content, cmap) + '\n';
  }
  return text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ---- Heuristic field guessing (used when no AI key is configured, or as a floor) ----

function guessName(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8);
  for (const line of lines) {
    // A name is often the first segment of a header line that also carries a title,
    // email, or phone ("Jane Doe | Software Engineer", "Jane Doe, Accountant").
    for (const segment of line.split(/\s*[|,•·]\s*|\s{2,}|\t/)) {
      const s = segment.trim();
      if (s.length > 3 && s.length < 40 && /^[A-Za-z][A-Za-z.'\- ]+$/.test(s) &&
          !/resume|curriculum|vitae|\bcv\b|profile|summary|objective/i.test(s)) {
        const words = s.split(/\s+/);
        if (words.length >= 2 && words.length <= 4) return s.replace(/\s+/g, ' ').trim();
      }
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

// ---- Multi-role work-experience extraction (heuristic) ----
// Finds an "Experience" section, then splits it into individual roles using
// date-range patterns ("Jan 2019 - Mar 2022", "2020 - Present", etc.) as anchors.
// This is inherently approximate — resume layouts vary wildly — but degrades
// gracefully: a section that isn't found or doesn't parse just yields [], and
// the user can still add experience cards manually exactly as before.

const MONTH_RE = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const DATE_RANGE_RE = new RegExp(
  `(?:${MONTH_RE}\\.?\\s+)?(\\d{4})\\s*(?:-|–|—|to)\\s*(?:${MONTH_RE}\\.?\\s+)?(\\d{4}|Present|Current|Now|Till date|Ongoing)`,
  'i'
);
const EXPERIENCE_SECTION_RE = /^(work\s+|professional\s+|employment\s+|career\s+)?(experience|work history|employment history)\s*:?$/i;
const OTHER_SECTION_HEADERS = [
  'education', 'academic', 'skills', 'technical skills', 'projects', 'certifications',
  'certificates', 'awards', 'publications', 'references', 'languages', 'interests',
  'hobbies', 'summary', 'objective', 'achievements', 'volunteer', 'extracurricular', 'activities',
];

function findExperienceSectionLines(text) {
  const lines = text.split('\n');
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim().toLowerCase().replace(/[:\-–—]+$/, '');
    if (EXPERIENCE_SECTION_RE.test(l)) { startIdx = i + 1; break; }
  }
  if (startIdx === -1) return null;
  let endIdx = lines.length;
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i].trim().toLowerCase().replace(/[:\-–—]+$/, '');
    if (l.length > 0 && l.length < 40 && OTHER_SECTION_HEADERS.some((h) => l === h || l.startsWith(h))) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx);
}

function guessExperienceHeuristic(text) {
  const sectionLines = findExperienceSectionLines(text);
  if (!sectionLines || !sectionLines.length) return [];

  const dateLineIdxs = [];
  sectionLines.forEach((line, i) => { if (DATE_RANGE_RE.test(line)) dateLineIdxs.push(i); });
  if (!dateLineIdxs.length) return [];

  const entries = [];
  for (let k = 0; k < dateLineIdxs.length && entries.length < 5; k++) {
    const idx = dateLineIdxs[k];
    const nextIdx = k + 1 < dateLineIdxs.length ? dateLineIdxs[k + 1] : sectionLines.length;
    const line = sectionLines[idx];
    const dm = line.match(DATE_RANGE_RE);
    if (!dm) continue;
    const startYear = parseInt(dm[1], 10);
    const endRaw = dm[2];
    const isCurrent = /present|current|now|ongoing|till date/i.test(endRaw);
    const endYear = isCurrent ? null : parseInt(endRaw, 10);

    const lineSansDate = line.replace(dm[0], '').replace(/[|,]+/g, ' ').trim();
    let contextLines = [];
    if (lineSansDate) contextLines.push(lineSansDate);
    if (idx > 0 && sectionLines[idx - 1].trim()) contextLines.unshift(sectionLines[idx - 1].trim());
    if (idx + 1 < nextIdx && sectionLines[idx + 1] && sectionLines[idx + 1].trim() &&
        !/^[•\-*▪●]/.test(sectionLines[idx + 1].trim())) {
      contextLines.push(sectionLines[idx + 1].trim());
    }
    contextLines = contextLines.filter(Boolean).slice(0, 3);

    let organization = null;
    let role = null;
    if (contextLines.length) {
      const first = contextLines[0];
      const sepMatch = first.match(/^(.+?)\s*(?:@|\bat\b|\||,|-|–|—)\s*(.+)$/);
      if (sepMatch) {
        role = sepMatch[1].trim();
        organization = sepMatch[2].trim();
      } else {
        role = first.trim();
      }
      if (!organization && contextLines[1]) organization = contextLines[1].trim();
    }

    // Reserve the line immediately before the next date-range (it's that next entry's
    // org/role title line, already claimed via contextLines.unshift above) so it doesn't
    // get misread as this entry's trailing achievement bullet.
    const achievementsEnd = k + 1 < dateLineIdxs.length ? Math.max(idx + 1, nextIdx - 1) : nextIdx;
    const achievements = [];
    for (let j = idx + 1; j < achievementsEnd && achievements.length < 4; j++) {
      const l = sectionLines[j].trim();
      if (!l || contextLines.includes(l)) continue;
      if (/^[•\-*▪●]/.test(l) || l.length > 20) achievements.push(l.replace(/^[•\-*▪●]\s*/, ''));
    }

    entries.push({
      organization: organization || null,
      role: role || null,
      achievements,
      startYear: isNaN(startYear) ? null : startYear,
      endYear: isNaN(endYear) ? null : endYear,
      isCurrent,
    });
  }
  return entries;
}

function heuristicExtract(text) {
  return {
    name: guessName(text),
    role: guessRole(text),
    experienceYears: guessExperienceYears(text),
    skills: guessSkills(text),
    experience: guessExperienceHeuristic(text),
  };
}

const AI_EXTRACTION_INSTRUCTIONS = `Extract structured resume data as strict JSON with exactly these keys: ` +
  `name (string or null), role (the person's most recent or current job title, string or null), ` +
  `experienceYears (number or null — total years of professional experience), ` +
  `skills (array of up to 20 short skill strings actually present in the resume — technical and ` +
  `professional skills only, no filler), ` +
  `experience (array of up to 5 past/current roles found in the resume's work-experience section, ` +
  `each an object with: organization (string or null), role (job title, string or null), ` +
  `achievements (array of up to 4 short bullet-point strings describing accomplishments in that role), ` +
  `startYear (number or null), endYear (number or null — omit/null if isCurrent is true), ` +
  `isCurrent (boolean — true if this is their present role, e.g. "Present"/"Current" in the dates)). ` +
  `Order experience from most recent to oldest. Return ONLY the JSON object, nothing else.`;

function normalizeAiExtraction(json) {
  if (!json) return null;
  const experience = Array.isArray(json.experience)
    ? json.experience.slice(0, 5).map((e) => ({
        organization: typeof e.organization === 'string' && e.organization.trim() ? e.organization.trim() : null,
        role: typeof e.role === 'string' && e.role.trim() ? e.role.trim() : null,
        achievements: Array.isArray(e.achievements)
          ? e.achievements.filter((a) => typeof a === 'string').slice(0, 4)
          : [],
        startYear: typeof e.startYear === 'number' ? e.startYear : null,
        endYear: typeof e.endYear === 'number' ? e.endYear : null,
        isCurrent: !!e.isCurrent,
      }))
    : [];
  return {
    name: typeof json.name === 'string' && json.name.trim() ? json.name.trim() : null,
    role: typeof json.role === 'string' && json.role.trim() ? json.role.trim() : null,
    experienceYears: typeof json.experienceYears === 'number' ? json.experienceYears : null,
    skills: Array.isArray(json.skills) ? json.skills.filter((s) => typeof s === 'string').slice(0, 20) : [],
    experience,
  };
}

async function aiExtract(text) {
  if (!ai.isAvailable()) return null;
  const prompt = `${AI_EXTRACTION_INSTRUCTIONS}\n\nResume text:\n${text.slice(0, 6000)}`;
  try {
    const raw = await ai.callClaude({ prompt, maxTokens: 1400 });
    return normalizeAiExtraction(ai.extractJson(raw));
  } catch (e) {
    console.error('AI CV extraction failed, falling back to heuristics:', e.message);
    return null;
  }
}

// Hands the raw PDF to Claude directly instead of our own hand-written text
// extraction. This app's PDF-to-text code can't correctly decode every embedded
// font encoding real-world PDF exporters use (some produce scrambled character
// substitutions rather than missing text) -- sending the file itself sidesteps
// that entirely, since Claude reads PDFs natively.
async function aiExtractFromPdfDocument(buffer) {
  if (!ai.isAvailable()) return null;
  try {
    const raw = await ai.callClaude({
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } },
        { type: 'text', text: `${AI_EXTRACTION_INSTRUCTIONS}\n\nThe resume is the attached PDF document.` },
      ],
      maxTokens: 1400,
    });
    return normalizeAiExtraction(ai.extractJson(raw));
  } catch (e) {
    console.error('AI PDF extraction failed, falling back to text extraction:', e.message);
    return null;
  }
}

async function extractFromCv(buffer, mime) {
  // For PDFs, try handing the file to Claude directly first -- our own text
  // extraction below can misdecode custom embedded fonts (see aiExtractFromPdfDocument).
  // No-ops (returns null immediately) when no ANTHROPIC_API_KEY is configured.
  if (mime === 'application/pdf') {
    const aiPdfResult = await aiExtractFromPdfDocument(buffer);
    if (aiPdfResult) return { ...aiPdfResult, source: 'ai' };
  }

  let text = '';
  try {
    if (mime === 'application/pdf') text = pdfBufferToText(buffer);
    else text = docxBufferToText(buffer); // .docx works well; legacy binary .doc will usually yield '' (fails gracefully)
  } catch (e) {
    console.error('CV text extraction failed:', e.message);
    text = '';
  }

  if (!text || text.replace(/\s/g, '').length < 30) {
    return { name: null, role: null, experienceYears: null, skills: [], experience: [], source: 'none' };
  }

  const aiResult = await aiExtract(text);
  if (aiResult) return { ...aiResult, source: 'ai' };

  return { ...heuristicExtract(text), source: 'heuristic' };
}

module.exports = { extractFromCv, pdfBufferToText, docxBufferToText, heuristicExtract, guessSkills, guessExperienceHeuristic };
