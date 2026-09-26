/**
 * Audio manager. All playback goes through here so the mute setting is respected everywhere.
 * Speech uses the platform voice (Web Speech API) as a placeholder until native-speaker
 * recordings exist; sound effects are synthesised with Web Audio, so no files are needed.
 * Only call from a user gesture (tap) — the first call unlocks audio on iOS.
 */
export type Sfx = 'correct' | 'tryAgain' | 'pop' | 'celebrate' | 'tap';

let muted = false;
let sfxMuted = false;
let ctx: AudioContext | null = null;

export function setMuted(value: boolean) {
  muted = value;
  if (muted && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** Sound effects have their own switch (FR-34: sound vs. voice & music). */
export function setSfxMuted(value: boolean) {
  sfxMuted = value;
}

export function isMuted() {
  return muted;
}

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const LANG_TAGS: Record<string, string> = { ar: 'ar-SA', en: 'en-US', hi: 'hi-IN' };

export type SpeechPart = { text: string; lang: 'ar' | 'en' | 'hi' };

export function speak(text: string, lang: SpeechPart['lang'] = 'en') {
  speakAll([{ text, lang }]);
}

/** Speaks parts in order (e.g. an English instruction followed by an Arabic letter name). */
export function speakAll(parts: SpeechPart[]) {
  if (muted || typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  parts.forEach(({ text, lang }) => speechSynthesis.speak(utterance(text, lang)));
}

/** Slow and clear for young children learning a new sound — not the platform's conversational default. */
const SPEECH_RATE = 0.7;

function utterance(text: string, lang: SpeechPart['lang']): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  const tag = LANG_TAGS[lang] ?? 'en-US';
  u.lang = tag;
  u.rate = SPEECH_RATE;
  u.pitch = 1.1;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(tag.slice(0, 2)));
  if (voice) u.voice = voice;
  return u;
}

/**
 * Speaks one piece of text and highlights whatever it's about (a letter, a word) for exactly as
 * long as it's being said — `onStart`/`onEnd` toggle the caller's own highlight state. Used where
 * a tap should visibly tie the sound to the glyph, e.g. the Learn card's letter and example word.
 */
export function speakWithHighlight(text: string, lang: SpeechPart['lang'], onStart: () => void, onEnd: () => void) {
  if (muted || typeof speechSynthesis === 'undefined') {
    onStart();
    onEnd();
    return;
  }
  speechSynthesis.cancel();
  const u = utterance(text, lang);
  u.onstart = onStart;
  u.onend = onEnd;
  u.onerror = onEnd;
  speechSynthesis.speak(u);
}

/**
 * Speaks a word and walks the highlight through its letters as it's pronounced, so a multi-letter
 * word glows one letter at a time instead of all at once. `segments` are the word's clusters
 * (a base letter plus any harakat on it) with their `start`/`end` offset in `text`, from
 * `lib/arabic`'s `clusters()`. Most voices never report per-character timing (`onboundary` is
 * word/sentence-level at best, especially for Arabic), so progress is paced by a timer sized to
 * the speech rate; a real `onboundary` character offset, when a voice does provide one, resyncs it.
 */
export function speakWithLetterHighlight(
  text: string,
  lang: SpeechPart['lang'],
  segments: Array<{ start: number; end: number }>,
  onIndex: (index: number) => void,
  onEnd: () => void,
) {
  if (muted || typeof speechSynthesis === 'undefined' || segments.length === 0) {
    onEnd();
    return;
  }
  speechSynthesis.cancel();
  const u = utterance(text, lang);
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };
  u.onstart = () => {
    let i = 0;
    onIndex(i);
    const perLetterMs = Math.max(180, 260 / SPEECH_RATE);
    timer = setInterval(() => {
      i += 1;
      if (i >= segments.length) return stop();
      onIndex(i);
    }, perLetterMs);
  };
  u.onboundary = (e) => {
    if (e.charIndex === undefined) return;
    const i = segments.findIndex((s) => e.charIndex >= s.start && e.charIndex < s.end);
    if (i !== -1) onIndex(i);
  };
  u.onend = () => {
    stop();
    onEnd();
  };
  u.onerror = () => {
    stop();
    onEnd();
  };
  speechSynthesis.speak(u);
}

const TONES: Record<Sfx, Array<[freq: number, start: number, dur: number]>> = {
  correct: [[660, 0, 0.12], [880, 0.12, 0.18]],
  tryAgain: [[330, 0, 0.15], [294, 0.15, 0.2]],
  pop: [[900, 0, 0.06]],
  tap: [[520, 0, 0.05]],
  celebrate: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.3]],
};

export function sfx(name: Sfx) {
  if (sfxMuted) return;
  const ac = audioContext();
  if (!ac) return;
  for (const [freq, start, dur] of TONES[name]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = ac.currentTime + start;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}
