// A sound when something lands.
//
// Mail arriving silently in a tab you are not looking at may as well not have arrived, and
// the interruption is the thing this product is teaching. So there is a tone — a soft two-
// note chime for email, a lighter single note for chat.
//
// Synthesised with the Web Audio API rather than shipped as files. Two reasons: the page's
// content-security rules do not allow fetching media, and a 20-byte oscillator beats a
// 40kB mp3 for a sound this short. It also means the tone is described in code, where it
// can be read and changed, rather than being an opaque binary in the repo.
//
// Browsers refuse to make noise until the user has interacted with the page, which is
// correct and not worth fighting: the context is created lazily on the first click or key
// press, and until then everything here is a no-op that fails quietly.

const STORAGE_KEY = 'tg.sound';

let ctx = null;
let armed = false;

function enabled() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true; // private windows and blocked storage should still get sound
  }
}

export function setSoundEnabled(on) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch { /* nothing to do — the preference just will not persist */ }
}

export function soundEnabled() {
  return enabled();
}

// Called from a real user gesture. Creating the context any earlier gets it suspended.
export function armSound() {
  if (armed) return;
  armed = true;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) ctx = new AudioCtx();
  } catch { ctx = null; }
}

// One note. `at` is an offset in seconds so two of these make a chime.
function note(freq, at, duration, peak) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t = ctx.currentTime + at;
  // A short attack and a long-ish exponential tail. A square envelope on a sine wave
  // clicks audibly at both ends, which sounds like a bug rather than a notification.
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function play(kind) {
  if (!enabled() || !ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    if (kind === 'mail') {
      // Two notes a fifth apart, rising. Reads as "something has arrived" rather than
      // "something has gone wrong".
      note(784, 0, 0.18, 0.075);     // G5
      note(1175, 0.085, 0.26, 0.055); // D6
    } else {
      note(988, 0, 0.13, 0.045);     // B5 — lighter, it is only a chat line
    }
  } catch { /* audio is a nicety; never let it break the page */ }
}

// What the app actually calls: given the previous and current message counts, make the
// right noise. Counting rather than being told means every path that adds a message —
// mail, chat, a manager's review — is covered without each one remembering to ring a bell.
export function announceArrivals(before, after) {
  if (!after || !before) return;
  const newMail = after.mail - before.mail;
  const newChat = after.chat - before.chat;
  if (newMail > 0) play('mail');
  else if (newChat > 0) play('chat');
}

// An email is a message with a subject; a chat line is one without. Same rule the inbox
// itself uses, so the two can never disagree about what counts as mail.
export function countMessages(state) {
  const msgs = (state && state.messages) || [];
  let mail = 0;
  let chat = 0;
  for (const m of msgs) {
    if (m.sender_archetype === 'learner') continue;
    if ((m.subject || '').trim()) mail += 1;
    else chat += 1;
  }
  return { mail, chat };
}
