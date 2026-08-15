// Thin, zero-dependency wrapper around the Anthropic Messages API (node:https only).
//
// This is entirely OPTIONAL. Every caller in this app checks isAvailable() (or just
// awaits these functions, which resolve to null when no key is set) and falls back to
// a transparent, rule-based heuristic. That means the app is fully functional without
// any AI key — setting ANTHROPIC_API_KEY just upgrades CV parsing and dashboard
// insights from "good heuristic guess" to "real AI-assisted extraction/reasoning".
//
// The key must be set as a Railway environment variable by the account owner —
// this code never receives or stores it any other way.

const https = require('node:https');

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

function isAvailable() {
  return Boolean(API_KEY);
}

function callClaude({ system, prompt, maxTokens }) {
  return new Promise((resolve) => {
    if (!API_KEY) return resolve(null);
    let payload;
    try {
      payload = JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens || 1024,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (e) {
      return resolve(null);
    }

    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 20000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.error('Claude API error', res.statusCode, body.slice(0, 300));
            return resolve(null);
          }
          try {
            const data = JSON.parse(body);
            const text = (data.content || []).map((b) => b.text || '').join('');
            resolve(text);
          } catch (e) {
            console.error('Claude API response parse error:', e.message);
            resolve(null);
          }
        });
      }
    );
    req.on('error', (e) => { console.error('Claude API request error:', e.message); resolve(null); });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

// Pulls a JSON object out of a model response, tolerant of ```json fences or
// leading/trailing prose the model might add despite instructions not to.
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

module.exports = { isAvailable, callClaude, extractJson };
