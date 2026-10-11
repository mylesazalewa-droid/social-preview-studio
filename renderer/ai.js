/* =========================================================================
   Social Preview Studio — AI layer
   - AI.heuristics.*  : pure, offline, free-forever text/image checks (no model)
   - AI.caps()        : what generative back-ends are available right now
   - AI.run(task, io) : run a generative task via the best available back-end
                        (BYO Gemini key  ->  Chrome on-device  ->  friendly error)
   Nothing here touches the DOM. app.js builds the UI on top of it.
   ========================================================================= */
(function () {
  'use strict';

  const AI = {};
  window.AI = AI;

  /* ----------------------------------------------------------------------
     1. HEURISTICS  — no network, no model, always available
     ---------------------------------------------------------------------- */
  const H = {};
  AI.heuristics = H;

  const EMOJI_RE = /\p{Extended_Pictographic}/gu;
  const WORD_RE = /[A-Za-z0-9'’]+/g;

  const syllables = (word) => {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    const m = word.match(/[aeiouy]{1,2}/g);
    return m ? m.length : 1;
  };

  // Flesch Reading Ease + Flesch–Kincaid grade level.
  H.readability = (text) => {
    const clean = (text || '').replace(EMOJI_RE, ' ').replace(/#[^\s#]+/g, ' ').replace(/https?:\/\/\S+/g, ' ');
    const sentences = (clean.match(/[.!?]+(\s|$)/g) || []).length || 1;
    const words = clean.match(WORD_RE) || [];
    const nWords = words.length;
    if (!nWords) return { grade: 0, ease: 100, words: 0, sentences: 0, avgSentence: 0, label: '—' };
    const nSyll = words.reduce((s, w) => s + syllables(w), 0);
    const ease = 206.835 - 1.015 * (nWords / sentences) - 84.6 * (nSyll / nWords);
    const grade = 0.39 * (nWords / sentences) + 11.8 * (nSyll / nWords) - 15.59;
    const g = Math.max(0, Math.round(grade));
    let label = 'clear';
    if (g >= 12) label = 'dense'; else if (g >= 9) label = 'a bit dense'; else if (g <= 5) label = 'very easy';
    return {
      grade: g,
      ease: Math.round(ease),
      words: nWords,
      sentences,
      avgSentence: +(nWords / sentences).toFixed(1),
      label,
      status: g >= 12 ? 'warn' : 'ok',
    };
  };

  // Longest sentences (for the "tighten this" nudge).
  H.longSentences = (text, max = 25) => {
    const parts = (text || '').replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/);
    return parts
      .map((s) => ({ s: s.trim(), n: (s.match(WORD_RE) || []).length }))
      .filter((x) => x.n > max)
      .sort((a, b) => b.n - a.n);
  };

  H.emojiNoise = (text) => {
    const all = (text || '').match(EMOJI_RE) || [];
    const runs = (text || '').match(/(\p{Extended_Pictographic}️?){3,}/gu) || [];
    const words = ((text || '').match(WORD_RE) || []).length || 1;
    const density = all.length / words;
    return {
      count: all.length,
      runs: runs.length,
      density: +density.toFixed(2),
      status: runs.length || density > 0.35 ? 'warn' : 'ok',
      note: runs.length ? 'Long emoji runs read as "fire fire fire" to screen readers'
        : density > 0.35 ? 'Heavy emoji use' : '',
    };
  };

  H.shoutiness = (text) => {
    const letters = (text || '').replace(/[^A-Za-z]/g, '').length;
    const caps = (text || '').replace(/[^A-Z]/g, '').length;
    const capsRatio = letters ? caps / letters : 0;
    const capWords = ((text || '').match(/\b[A-Z]{3,}\b/g) || []).filter((w) => w !== 'AMEN' && w !== 'RSVP');
    const bangs = ((text || '').match(/!/g) || []).length;
    return {
      capsRatio: +capsRatio.toFixed(2),
      capWords,
      exclamations: bangs,
      status: capsRatio > 0.3 || bangs >= 4 || capWords.length >= 3 ? 'warn' : 'ok',
      note: capsRatio > 0.3 ? 'Lots of ALL-CAPS' : bangs >= 4 ? 'Lots of exclamation marks'
        : capWords.length >= 3 ? 'Several shouted words' : '',
    };
  };

  const CTA_PATTERNS = [
    /\b(join us|come|bring|rsvp|register|sign up|save the date|invite|share|comment|tag|tap|click|swipe|dm us|learn more|watch|listen|read|give|donate|pray|serve|volunteer|link in bio|follow)\b/i,
    /\?\s*$/,
  ];
  H.cta = (text) => {
    const t = (text || '').trim();
    const has = CTA_PATTERNS.some((re) => re.test(t));
    return { has, status: has ? 'ok' : 'warn', note: has ? '' : 'No clear next step for the reader' };
  };

  // Church / insider jargon a newcomer may not follow.
  const JARGON = [
    'fellowship hall', 'narthex', 'sanctuary', 'the body', 'body of christ', 'greeters', 'ushers',
    'small group', 'life group', 'connect group', 'sunday school', 'vbs', 'wednesday night',
    'love offering', 'tithe', 'tithes and offerings', 'altar call', 'invitation', 'benediction',
    'doxology', 'communion', 'the lord’s supper', 'baptismal', 'catechism', 'liturgy',
    'the nursery', 'children’s church', 'youth group', 'discipleship', 'quiet time',
  ];
  H.plainLanguage = (text) => {
    const low = ' ' + (text || '').toLowerCase() + ' ';
    const hits = JARGON.filter((j) => low.includes(' ' + j + ' ') || low.includes(' ' + j + ','));
    return { hits, status: hits.length ? 'note' : 'ok' };
  };

  // Scripture reference linter (uses window.BIBLE_BOOKS / BIBLE_ALIASES).
  const REF_RE = /\b((?:[1-3]\s?)?[A-Za-z][A-Za-z.]{1,20}(?:\s+of\s+\w+)?)\.?\s+(\d{1,3})(?::(\d{1,3})(?:[-–]\d{1,3})?)?\b/g;
  H.scripture = (text) => {
    const books = window.BIBLE_BOOKS || {};
    const aliases = window.BIBLE_ALIASES || {};
    const misspell = window.BIBLE_MISSPELLINGS || {};
    const canonLower = {};
    Object.keys(books).forEach((b) => { canonLower[b.toLowerCase()] = b; });
    const out = [];
    let m;
    REF_RE.lastIndex = 0;
    while ((m = REF_RE.exec(text || '')) !== null) {
      const raw = m[0].trim();
      let name = m[1].trim().replace(/\.$/, '').replace(/\s+/g, ' ');
      const chap = +m[2];
      const verse = m[3] ? +m[3] : null;
      const key = name.toLowerCase();
      if (misspell[key]) { out.push({ raw, ok: false, reason: 'spelling', canon: misspell[key], detail: `spelled “${misspell[key]}”` }); continue; }
      const exact = !!canonLower[key];
      let canon = canonLower[key] || aliases[key] || null;
      // try "1john" style with a space
      if (!canon && /^[1-3][a-z]/i.test(key)) {
        const spaced = key.replace(/^([1-3])\s*/, '$1 ');
        canon = canonLower[spaced] || aliases[spaced] || null;
      }
      if (!canon) {
        // only flag if it *looks* like a scripture ref (has verse or matches a partial book)
        const near = Object.keys(books).find((b) => b.toLowerCase().startsWith(key.slice(0, 4)));
        if (verse || near) out.push({ raw, ok: false, reason: 'unknown-book', suggest: near || null });
        continue;
      }
      const maxCh = books[canon];
      // single-chapter books (Jude, Obadiah, Philemon, 2-3 John) are cited "Book v" — the number is a verse
      if (maxCh === 1) {
        const v = verse != null ? verse : chap;
        if (v > 90) out.push({ raw, ok: false, reason: 'high-verse', canon, detail: `verse ${v} is unusually high — double-check` });
        else out.push({ raw, ok: true, canon, chap: 1, verse: v });
        continue;
      }
      if (chap > maxCh) { out.push({ raw, ok: false, reason: 'bad-chapter', canon, detail: `${canon} has ${maxCh} chapters` }); continue; }
      if (verse && verse > 90) {
        out.push({ raw, ok: false, reason: 'high-verse', canon, detail: `verse ${verse} is unusually high — double-check` });
        continue;
      }
      out.push({ raw, ok: true, canon, chap, verse });
    }
    const bad = out.filter((r) => !r.ok);
    return { refs: out, bad, status: bad.length ? 'warn' : (out.length ? 'ok' : 'idle') };
  };

  // Where the caption gets cut off vs. where the "important" bits are.
  // `folds` = [{ platform, at }] truncation points supplied by the caller.
  H.hookFold = (text, folds) => {
    const t = (text || '').trim();
    if (!t) return { rows: [], status: 'idle' };
    const firstLine = t.split('\n')[0];
    const ctaIdx = (() => {
      const re = /\b(join us|come|bring|rsvp|register|sign up|save the date|this (sunday|saturday|weekend)|tonight|tomorrow|link in bio|\d{1,2}(:\d\d)?\s?(am|pm)|\bat \d)/i;
      const m = re.exec(t); return m ? m.index : -1;
    })();
    const rows = (folds || []).map((f) => {
      const cut = f.at || 0;
      const hidden = ctaIdx >= 0 && ctaIdx > cut;
      return { platform: f.platform, at: cut, ctaHidden: hidden };
    });
    return {
      rows,
      firstLineLen: firstLine.length,
      ctaIdx,
      status: rows.some((r) => r.ctaHidden) ? 'warn' : (firstLine.length > 125 ? 'note' : 'ok'),
    };
  };

  // Image quality from a data URL (resolution, blur, brightness). Canvas only.
  H.imageQuality = (dataUrl, spec) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        const need = spec && spec.length === 2 ? spec : null;
        const under = need ? (w < need[0] * 0.9 || h < need[1] * 0.9) : (Math.min(w, h) < 800);
        // downscale for a cheap sharpness estimate
        const c = document.createElement('canvas');
        const s = Math.min(1, 220 / Math.max(w, h));
        c.width = Math.max(1, Math.round(w * s));
        c.height = Math.max(1, Math.round(h * s));
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        let lap = 0, lum = 0, n = 0;
        try {
          const d = ctx.getImageData(0, 0, c.width, c.height).data;
          const gray = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          for (let y = 1; y < c.height - 1; y++) {
            for (let x = 1; x < c.width - 1; x++) {
              const i = (y * c.width + x) * 4;
              const v = gray(i);
              lum += v; n++;
              const l = gray(i - 4) + gray(i + 4) + gray(i - c.width * 4) + gray(i + c.width * 4) - 4 * v;
              lap += l * l;
            }
          }
        } catch (e) { /* tainted */ resolve({ ok: true, w, h, note: '' }); return; }
        const sharp = lap / (n || 1);
        const bright = lum / (n || 1);
        const notes = [];
        if (under) notes.push(need ? `smaller than ${need[0]}×${need[1]}` : 'low resolution');
        if (sharp < 40) notes.push('looks soft / blurry');
        if (bright < 45) notes.push('very dark');
        if (bright > 232) notes.push('very bright / washed out');
        resolve({ ok: notes.length === 0, w, h, sharp: Math.round(sharp), bright: Math.round(bright), notes, status: notes.length ? 'warn' : 'ok' });
      };
      img.onerror = () => resolve({ ok: true, note: '' });
      img.src = dataUrl;
    });

  // Consistency of a recurring phrase across many captions.
  H.seriesConsistency = (captions) => {
    const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const phraseCounts = {};
    (captions || []).forEach((c) => {
      const m = (c || '').match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g) || [];
      m.forEach((p) => {
        const k = norm(p);
        (phraseCounts[k] = phraseCounts[k] || { variants: new Set(), n: 0 }).variants.add(p.trim());
        phraseCounts[k].n++;
      });
    });
    const clashes = Object.entries(phraseCounts)
      .filter(([, v]) => v.n >= 2 && v.variants.size >= 2)
      .map(([k, v]) => ({ phrase: k, variants: [...v.variants] }));
    return { clashes, status: clashes.length ? 'note' : 'ok' };
  };

  /* ----------------------------------------------------------------------
     2. CAPABILITIES
     ---------------------------------------------------------------------- */
  let _keyStatus = { hasKey: false };
  AI.refreshKeyStatus = async () => {
    try { _keyStatus = await window.api.ai.keyStatus(); } catch (e) { _keyStatus = { hasKey: false }; }
    return _keyStatus;
  };

  // Chrome's built-in on-device AI (LanguageModel / Summarizer / …) is present in
  // Electron's Chromium but has NO model behind it — prompt() just echoes the input.
  // We do not use it. The one back-end is the user's free Google Gemini key.
  AI.caps = async () => ({
    gemini: !!_keyStatus.hasKey,
    local: false,
    localDownloadable: false,
    localVision: false,
    any: !!_keyStatus.hasKey,
    vision: !!_keyStatus.hasKey,
  });

  // kept for the UI's optional "turn on" affordance — always a no-op here
  AI.probeOnDevice = async () => {};
  AI.warmup = async () => { throw new AIError('no-ondevice'); };

  /* ----------------------------------------------------------------------
     3. PROMPTS  — one per task
     ---------------------------------------------------------------------- */
  const VOICE = `You write social media copy for a church communications team.
Warm, plain-spoken, welcoming, never preachy, salesy, or guilt-inducing.
Short sentences. No hashtags unless asked. No markdown. No quotation marks around the whole caption.
Assume readers may be new or not religious.`;

  const PLATFORM_STYLE = {
    'ig-feed': 'Instagram feed: warm and personal, a strong first line before the "... more" fold, up to ~4 short paragraphs.',
    'ig-story': 'Instagram Story: one or two punchy lines, big and glanceable.',
    'ig-reel': 'Instagram Reel: a scroll-stopping first line, casual, ~1-2 sentences.',
    'tiktok': 'TikTok: casual and human, hook first, very short.',
    'yt-shorts': 'YouTube Shorts: short, curiosity-driven title-style line.',
    'yt-thumb': 'YouTube thumbnail: 3-5 punchy words max, all readable at small size.',
    'x': 'X/Twitter: one tight sentence, under 240 characters, no fluff.',
    'fb-feed': 'Facebook: friendly and clear, a little more room, spell out details (date, time, place).',
    'li-feed': 'LinkedIn: professional but human, lead with the point.',
  };

  const PROMPTS = {
    rewrite: ({ text, tone }) => ({
      system: VOICE,
      parts: `Rewrite this caption to be ${tone}. Keep the meaning and any facts (dates, times, names) exactly. Return only the rewritten caption.\n\n---\n${text}`,
      temperature: 0.6,
    }),
    variants: ({ text, n = 3 }) => ({
      system: VOICE,
      json: true,
      parts: `Write ${n} genuinely different versions of this caption — different angles (e.g. a curiosity hook, a direct invite, a short story), not paraphrases. Keep all facts. Return JSON: {"variants":[{"angle":"...","text":"..."}]}\n\n---\n${text}`,
      temperature: 0.9,
    }),
    hook: ({ text, limit }) => ({
      system: VOICE,
      parts: `Rewrite ONLY the first line of this caption so the most compelling idea lands before a reader taps "... more"${limit ? ` (aim for under ${limit} characters)` : ''}. Then keep the rest of the caption. Return the full caption.\n\n---\n${text}`,
      temperature: 0.7,
    }),
    toneCheck: ({ text }) => ({
      system: VOICE,
      json: true,
      parts: `Read this caption as a first-time visitor. Return JSON:
{"reads_as":"one short phrase, e.g. 'warm invite' or 'a bit guilt-trippy'","flags":["short issues, may be empty"],"suggestion":"a gentler rewrite, or empty if it's already good"}\n\n---\n${text}`,
      temperature: 0.4,
    }),
    repurpose: ({ text, platforms }) => ({
      system: VOICE,
      json: true,
      parts: `Adapt this one caption for each platform below. Keep every fact. Match each platform's style.
Platforms:\n${platforms.map((p) => `- ${p.id}: ${PLATFORM_STYLE[p.id] || p.name}`).join('\n')}
Return JSON: {"captions":{"<platform id>":"..."}}\n\n---\n${text}`,
      temperature: 0.7,
    }),
    translate: ({ text, lang }) => ({
      system: `You are a professional translator. Translate faithfully and naturally into ${lang}. Keep names, dates and times. Return only the translation.`,
      parts: text,
      temperature: 0.3,
    }),
    backTranslate: ({ text }) => ({
      system: `Translate the following into natural English. Return only the English.`,
      parts: text,
      temperature: 0.3,
    }),
    hashtags: ({ text, brand }) => ({
      system: `You suggest hashtags for a church's social posts.`,
      json: true,
      parts: `From this caption, suggest hashtags in three buckets. Avoid giant generic tags (#jesus, #church). Prefer specific + local + branded.${brand ? ` The church's handle is ${brand}.` : ''}
Return JSON: {"branded":["..."],"topical":["..."],"local":["(placeholders like #YourCityChurch)"]}\n\n---\n${text}`,
      temperature: 0.6,
    }),
    altText: ({ mime, data, context }) => ({
      system: `You write image alt text for social media. One sentence, under 125 characters, describes what a person would see. No "image of". State visible text verbatim. Neutral and factual.`,
      parts: [
        { text: context ? `Context (the caption): ${context}\n\nWrite alt text for this image:` : 'Write alt text for this image:' },
        { inlineData: { mimeType: mime, data } },
      ],
      temperature: 0.2,
    }),
    eventFromFlyer: ({ mime, data }) => ({
      system: `You extract event details from a flyer or graphic.`,
      json: true,
      parts: [
        { text: `Read this event graphic. Return JSON with what you can find (empty string if not shown):
{"title":"","date":"","time":"","location":"","details":"","suggested_caption":"a warm 2-3 sentence caption inviting people"}` },
        { inlineData: { mimeType: mime, data } },
      ],
      temperature: 0.3,
    }),
    thumbLegibility: ({ mime, data }) => ({
      system: `You judge whether a YouTube thumbnail's text is readable at small (grid) size.`,
      json: true,
      parts: [
        { text: `Return JSON: {"text_on_image":"the words you see","readable_small":true/false,"notes":"short advice"}` },
        { inlineData: { mimeType: mime, data } },
      ],
      temperature: 0.2,
    }),
    sermonPack: ({ source, count, brand }) => ({
      system: VOICE,
      json: true,
      parts: `Here are sermon notes / a transcript. Produce a week of social content for ${brand || 'the church'}.
Return JSON:
{
 "series_title": "short name for this theme",
 "key_scriptures": ["Book 0:0", "..."],
 "pull_quotes": ["5 short, quotable lines lifted or lightly tightened from the source"],
 "posts": [
   {"day":"e.g. Monday","platform":"ig-feed","caption":"...","first_comment":"optional hashtags/link line"}
 ]
}
Make ${count || 5} posts, varied across Instagram feed, Story, Facebook and X. Keep every claim faithful to the source.\n\n--- SOURCE ---\n${source}`,
      temperature: 0.8,
    }),
    pullQuotes: ({ source }) => ({
      system: `You find the most shareable lines in a talk.`,
      json: true,
      parts: `Return JSON {"quotes":["up to 6 short lines, each under 120 characters, lifted or lightly tightened, faithful to the source"]}\n\n---\n${source}`,
      temperature: 0.6,
    }),
    verseSuggest: ({ text }) => ({
      system: `You suggest fitting Bible passages. Protestant canon. Use full book names and standard references.`,
      json: true,
      parts: `Suggest 3 passages that fit the theme of this caption. Return JSON: {"passages":[{"ref":"Philippians 4:6-7","why":"one short reason"}]}\n\n---\n${text}`,
      temperature: 0.5,
    }),
    feedbackPunchList: ({ notes }) => ({
      system: `You turn review feedback into a short, actionable checklist for a designer.`,
      json: true,
      parts: `Return JSON {"items":["imperative, specific, one change each"],"blockers":["anything marked needs-work / must-fix"]}\n\n--- FEEDBACK ---\n${notes}`,
      temperature: 0.3,
    }),
    plainLanguageRewrite: ({ text, terms }) => ({
      system: VOICE,
      parts: `Rewrite so a first-time visitor with no church background understands it. Replace or briefly explain insider terms${terms && terms.length ? ` (found: ${terms.join(', ')})` : ''}. Keep all facts. Return only the caption.\n\n---\n${text}`,
      temperature: 0.5,
    }),
    videoMoments: ({ mime, data, durationSec }) => ({
      system: `You find the most compelling, self-contained moments in a sermon or event recording for a short vertical social clip (like Opus Clip). You listen for hooks, punchy one-liners, stories with a clear beginning and end, and emotional or surprising beats — never a sentence cut off mid-thought.`,
      json: true,
      parts: [
        { text: `This audio runs about ${Math.round(durationSec || 0)} seconds. Find up to 12 candidate moments, each a continuous span of ${Math.round(durationSec || 0) > 120 ? '8-45' : '5-25'} seconds that stands alone without needing earlier context. Prefer moments that could open OR close a short clip. Timestamps are from the very start of this audio (0:00), as "m:ss".

Return JSON:
{"segments":[{"start":"m:ss","end":"m:ss","transcript":"what's said, verbatim","why":"one short phrase — the hook, the story, the punchline","score":1-10}]}

Order by score, highest first.` },
        { inlineData: { mimeType: mime, data } },
      ],
      temperature: 0.4,
      timeoutMs: 180000, // a long recording takes Google noticeably longer to listen through
    }),
  };

  // Never let a network call hang forever.
  function withTimeout(promise, ms, label) {
    let t;
    const timeout = new Promise((_, rej) => {
      t = setTimeout(() => rej(new AIError('timeout', label || 'The AI took too long — try again.')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
  }

  /* ----------------------------------------------------------------------
     5. BACK-ENDS
     ---------------------------------------------------------------------- */
  async function runGemini(spec) {
    const r = await withTimeout(window.api.ai.gemini({
      parts: spec.parts, system: spec.system,
      json: !!spec.json, temperature: spec.temperature,
    }), spec.timeoutMs || 45000, 'Google took too long to respond — try again.');
    if (!r.ok) {
      if (r.error === 'no-key') throw new AIError('no-backend');
      throw new AIError('gemini', r.error);
    }
    return r.text;
  }

  function AIError(kind, detail) { this.name = 'AIError'; this.kind = kind; this.message = detail || kind; }
  AIError.prototype = Object.create(Error.prototype);
  AI.AIError = AIError;

  /* ----------------------------------------------------------------------
     6. RUN — via the user's Gemini key, or a clear "add a key" error
     ---------------------------------------------------------------------- */
  AI.run = async (task, io) => {
    const make = PROMPTS[task];
    if (!make) throw new Error('unknown AI task: ' + task);
    const spec = make(io || {});
    const wantVision = Array.isArray(spec.parts) && spec.parts.some((p) => p.inlineData);
    const caps = await AI.caps();
    if (!caps.gemini) throw new AIError(wantVision ? 'no-vision' : 'no-backend');
    return finish(task, await runGemini(spec), spec);
  };

  function finish(task, raw, spec) {
    let text = (raw || '').trim();
    // strip accidental code fences
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    if (spec.json) {
      try { return JSON.parse(text); }
      catch (e) {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) { try { return JSON.parse(m[0]); } catch (e2) {} }
        throw new AIError('bad-json', text.slice(0, 200));
      }
    }
    // unwrap a single pair of wrapping quotes
    if (/^"[\s\S]*"$/.test(text)) text = text.slice(1, -1);
    return text;
  }

  /* small helper for callers: friendly message for an error */
  AI.explain = (e) => {
    if (!e) return 'Something went wrong.';
    if (e.kind === 'download') return 'Open the AI panel and turn on the model first.';
    if (e.kind === 'no-ondevice' || e.kind === 'no-backend')
      return 'Add a free Google Gemini key in the AI panel to use the writing tools — it takes about a minute and needs no credit card.';
    if (e.kind === 'no-vision') return 'Reading images or audio needs a free Google Gemini key — add one in the AI panel.';
    if (e.kind === 'timeout') return e.message || 'The AI took too long — try again.';
    if (e.kind === 'bad-json') return 'The model returned something unexpected — try again.';
    if (e.kind === 'gemini') return e.message || 'The AI request failed.';
    return e.message || 'Something went wrong.';
  };
})();
