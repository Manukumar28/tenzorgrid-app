import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { Avatar } from './ui.jsx';
import { api } from '../api.js';

// The two-minute stand-up.
//
// Asha speaks through the browser's own speech synthesis and listens through its speech
// recognition. Both are free and local — no audio ever leaves the machine, and it costs
// nothing per learner, which is what makes a DAILY ritual affordable at all.
//
// Recognition is Chrome/Edge only (Firefox and most of Safari have synthesis but not
// recognition). So typing is the real path and voice is the upgrade layered on top: a
// learner on Firefox gets the entire ritual, just with their fingers. The reverse —
// building for voice and bolting on a text fallback — would have left a third of people
// with a broken feature.

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Asha's voice: prefer a female en-IN or en-GB voice if the machine has one, otherwise
// take whatever English voice exists. Never fail loudly over this — a missing voice
// should degrade to silence, not to a broken stand-up.
function pickVoice() {
  if (!canSpeak) return null;
  const all = window.speechSynthesis.getVoices() || [];
  return all.find((v) => /en-IN/i.test(v.lang) && /female|kalpana|heera|neerja/i.test(v.name))
    || all.find((v) => /en-IN/i.test(v.lang))
    || all.find((v) => /en-GB/i.test(v.lang) && /female|serena|kate|sonia/i.test(v.name))
    || all.find((v) => /^en/i.test(v.lang))
    || null;
}

export default function Standup({ standup, manager, learnerName, learnerPhotoUrl, onClose, onDone }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({ done: '', today: '', blockers: '' });
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(!canSpeak);
  const [usedVoice, setUsedVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reply, setReply] = useState(null);
  const recog = useRef(null);
  const q = standup.questions[i];

  // Say the current question. Cancelling first matters: without it, moving quickly
  // through the questions queues them and Asha talks over herself.
  useEffect(() => {
    if (muted || !canSpeak || reply) return;
    const line = i === 0 ? `${standup.greeting} ${q.text}` : q.text;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(line);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1.02;
    try { window.speechSynthesis.speak(u); } catch { /* a silent stand-up still works */ }
    return () => window.speechSynthesis.cancel();
  }, [i, muted, reply]);

  useEffect(() => () => { if (canSpeak) window.speechSynthesis.cancel(); }, []);

  function toggleMic() {
    if (!SR) return;
    if (listening) { recog.current && recog.current.stop(); return; }
    const r = new SR();
    r.lang = 'en-IN';
    r.interimResults = true;
    r.continuous = true;
    let base = answers[q.id] ? answers[q.id] + ' ' : '';
    r.onresult = (e) => {
      let text = '';
      for (let n = e.resultIndex; n < e.results.length; n++) text += e.results[n][0].transcript;
      setAnswers((a) => ({ ...a, [q.id]: (base + text).trim() }));
      // Only the final result is committed to `base`, or interim text repeats itself.
      if (e.results[e.results.length - 1].isFinal) base = (base + text).trim() + ' ';
      setUsedVoice(true);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recog.current = r;
    // Asha must stop talking before the mic opens, or she transcribes herself.
    if (canSpeak) window.speechSynthesis.cancel();
    try { r.start(); setListening(true); } catch { setListening(false); }
  }

  function next() {
    if (listening && recog.current) recog.current.stop();
    setI((n) => Math.min(standup.questions.length - 1, n + 1));
  }

  async function finish() {
    if (listening && recog.current) recog.current.stop();
    setBusy(true); setError('');
    try {
      const d = await api.submitStandup(answers, usedVoice);
      setReply(d);
      if (canSpeak && !muted) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(d.reply);
        const v = pickVoice();
        if (v) u.voice = v;
        try { window.speechSynthesis.speak(u); } catch { /* silence is fine */ }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const last = i === standup.questions.length - 1;
  const managerName = manager ? manager.name : standup.manager;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6" role="dialog" aria-label="Daily stand-up">
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <Avatar name={managerName} photoUrl={manager && manager.avatarUrl} size={30} />
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-slate-900 leading-tight">{managerName}</p>
            <p className="text-[11px] text-slate-500">Daily stand-up · {standup.minutes} minutes</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {canSpeak && (
              <button
                onClick={() => { setMuted((m) => !m); window.speechSynthesis.cancel(); }}
                aria-label={muted ? 'Turn her voice on' : 'Turn her voice off'}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-200"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
            <button onClick={onClose} aria-label="Close the stand-up" className="p-2 rounded-lg text-slate-500 hover:bg-slate-200">
              <X size={16} />
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {reply ? (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={17} className="text-emerald-600" />
                <span className="text-sm font-extrabold text-slate-900">Stand-up done</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-5">{reply.reply}</p>
              <p className="text-[11px] text-slate-500 mb-5">
                It's in your thread with {managerName.split(' ')[0]}, so you can both refer back to it.
              </p>
              <button
                onClick={() => onDone(reply.state)}
                aria-label="Back to your work"
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
              >
                Back to work
              </button>
            </motion.div>
          ) : (
            <motion.div key={q.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="p-6">
              <div className="flex gap-1 mb-4">
                {standup.questions.map((x, n) => (
                  <span key={x.id} className={`h-1.5 flex-1 rounded-full ${n <= i ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                ))}
              </div>

              <p className="text-base font-bold text-slate-900 leading-relaxed mb-1">{q.text}</p>
              {q.hint && <p className="text-[11px] text-slate-500 mb-4">{q.hint}</p>}

              <div className="relative">
                <textarea
                  value={answers[q.id]}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  rows={4}
                  aria-label={`Your answer: ${q.text}`}
                  placeholder={SR ? 'Speak, or type here…' : 'Type your answer…'}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-3 pr-12 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                {SR && (
                  <button
                    onClick={toggleMic}
                    aria-label={listening ? 'Stop recording' : 'Answer out loud'}
                    className={`absolute right-2.5 top-2.5 p-2.5 rounded-lg transition-colors ${
                      listening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {listening ? <MicOff size={15} /> : <Mic size={15} />}
                  </button>
                )}
              </div>

              {!SR && (
                <p className="text-[11px] text-slate-400 mt-2">
                  Your browser can't do speech input — Chrome and Edge can. Typing works exactly the same.
                </p>
              )}
              {error && <p className="text-xs text-rose-700 font-semibold mt-3">{error}</p>}

              <div className="flex items-center justify-between gap-3 mt-5">
                <span className="text-[11px] text-slate-400">Question {i + 1} of {standup.questions.length}</span>
                {last ? (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={finish}
                    disabled={busy}
                    aria-label="Finish the stand-up"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-40"
                  >
                    {busy ? 'Sending…' : 'Finish stand-up'}
                  </motion.button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={next}
                    aria-label="Next question"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
                  >
                    Next <ArrowRight size={14} />
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
