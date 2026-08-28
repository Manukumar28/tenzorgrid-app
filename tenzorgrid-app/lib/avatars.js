// Self-hosted 3D avatar illustrations (public/assets/avatars/, from the user's own Figma
// "116 3D Animoji avatars" set) — no external network dependency, unlike a hotlinked
// avatar-generator API. manifest.json tags each file male/female so a character's
// gender always gets a fitting pick.

const fs = require('node:fs');
const path = require('node:path');

const MANIFEST_PATH = path.join(__dirname, '..', 'public', 'assets', 'avatars', 'manifest.json');
const MANIFEST = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const BY_GENDER = {
  male: MANIFEST.filter((a) => a.gender === 'male'),
  female: MANIFEST.filter((a) => a.gender === 'female'),
};

function hashSeed(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic per-seed pick from the matching gender pool — the same seed (e.g. an
// archetype key) always lands on the same avatar, so a character doesn't change face
// between page loads, but different seeds spread out across the pool ("randomly pick
// one" without re-rolling on every request). Pass a `used` Set when assigning several
// characters together so two of them never end up with the same picture.
function pickAvatar(seed, gender, used) {
  const pool = BY_GENDER[gender] || BY_GENDER.female;
  let idx = hashSeed(String(seed)) % pool.length;
  if (used) {
    let tries = 0;
    while (used.has(pool[idx].file) && tries < pool.length) {
      idx = (idx + 1) % pool.length;
      tries++;
    }
  }
  const pick = pool[idx];
  if (used) used.add(pick.file);
  return '/assets/avatars/' + pick.file;
}

module.exports = { pickAvatar };
