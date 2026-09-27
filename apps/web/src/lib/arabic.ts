/** Script text helpers — segmenting a word into tappable/highlightable letters without ever
 * separating a combining mark (an Arabic haraka, a Hindi matra/chandrabindu/anusvara) from its
 * base letter. Arabic also reshapes a letter by its neighbours, so an Arabic segment rendered in
 * its own sibling span carries a zero-width joiner (U+200D) on the sides where it connects — no
 * other script needs that trick. */
export const ZWJ = '‍';

const NON_JOINING = new Set(['ا', 'أ', 'إ', 'آ', 'د', 'ذ', 'ر', 'ز', 'و', 'ؤ', 'ة', 'ء']);
// Any Unicode combining mark (general category Mn): Arabic harakat, Hindi matras, chandrabindu, virama...
const COMBINING_MARK = /\p{Mn}/u;

export function joinsNext(ch: string): boolean {
  return !NON_JOINING.has(ch) && !COMBINING_MARK.test(ch);
}

export interface PositionForms {
  isolated: string;
  initial: string;
  medial: string;
  final: string;
}

export function positionForms(glyph: string): PositionForms {
  const next = joinsNext(glyph);
  return {
    isolated: glyph,
    initial: next ? glyph + ZWJ : glyph,
    medial: next ? ZWJ + glyph + ZWJ : ZWJ + glyph,
    final: ZWJ + glyph,
  };
}

export interface Segment {
  index: number;
  char: string;
  /** Display text with ZWJ so the joined form is kept when rendered in its own span. */
  display: string;
}

/** Splits an unvowelled word into tappable segments that still render joined. */
export function joinedSegments(word: string): Segment[] {
  const chars = [...word];
  return chars.map((char, i) => {
    const prev = chars[i - 1];
    const joinPrev = prev !== undefined && joinsNext(prev) && prev !== ' ' && char !== ' ';
    const joinNext = i < chars.length - 1 && joinsNext(char) && chars[i + 1] !== ' ';
    return { index: i, char, display: (joinPrev ? ZWJ : '') + char + (joinNext ? ZWJ : '') };
  });
}

/** Letters that count as the same letter for "find the letter" (hamza seats on alif). */
export function sameLetter(a: string, b: string): boolean {
  const norm = (c: string) => (c === 'أ' || c === 'إ' || c === 'آ' ? 'ا' : c);
  return norm(a) === norm(b);
}

export interface Cluster {
  /** The base letter plus any combining marks riding on it — kept together so a mark is never split from its letter. */
  text: string;
  /** Display text, with ZWJ added when `joinShapes` keeps the Arabic joined form in its own span. */
  display: string;
  /** UTF-16 offset range in the original word, for mapping a speech `charIndex` back to a cluster. */
  start: number;
  end: number;
}

/**
 * Splits a word into tappable/highlightable clusters (a base letter plus any combining marks on
 * it). Pass `joinShapes: true` only for Arabic: it adds ZWJ so a letter rendered alone in its own
 * span still takes its joined (initial/medial/final) shape — other scripts don't reshape by
 * neighbour, so they render correctly with the plain letter.
 */
export function clusters(word: string, joinShapes: boolean): Cluster[] {
  const chars = [...word];
  const base: Array<{ text: string; start: number; end: number }> = [];
  let pos = 0;
  for (let i = 0; i < chars.length; ) {
    const first = chars[i]!;
    let text = first;
    const start = pos;
    pos += first.length;
    i += 1;
    while (i < chars.length && COMBINING_MARK.test(chars[i]!)) {
      const mark = chars[i]!;
      text += mark;
      pos += mark.length;
      i += 1;
    }
    base.push({ text, start, end: pos });
  }
  if (!joinShapes) return base.map((c) => ({ ...c, display: c.text }));
  return base.map((c, i) => {
    const prev = base[i - 1];
    const next = base[i + 1];
    const letter = c.text[0]!;
    const joinPrev = prev !== undefined && joinsNext(prev.text[0]!) && letter !== ' ' && prev.text[0] !== ' ';
    const joinNext = next !== undefined && joinsNext(letter) && next.text[0] !== ' ';
    return { ...c, display: (joinPrev ? ZWJ : '') + c.text + (joinNext ? ZWJ : '') };
  });
}

/** Same tappable segments as `joinedSegments`/`clusters`, picking the right strategy per script:
 * Arabic's `plain` word has no combining marks, so per-letter + ZWJ join is safe; other scripts'
 * words do carry combining marks (Hindi matras...), so their letters are grouped into clusters. */
export function letterSegments(word: string, courseId: string): Segment[] {
  if (courseId === 'ar') return joinedSegments(word);
  return clusters(word, false).map((c, i) => ({ index: i, char: c.text[0]!, display: c.display }));
}
