import { courseItems, getItem, taughtItemsUpTo, type JourneyNode, nodeItems } from '@/content/course';
import { activitySchema, type Activity, type LearningItem } from '@/content/schema';
import { createRng, pickDistinct, shuffle } from '@/engine/random';
import { sameLetter } from '@/lib/arabic';

/** Plain (unvowelled) example words in the course that contain the given letter. */
export function wordsContaining(item: LearningItem, pool: LearningItem[]): string[] {
  const words = pool.map((i) => i.example.plain).filter((w) => [...w].some((c) => sameLetter(c, item.glyph)));
  return words.length > 0 ? words : [item.example.plain];
}

/**
 * Wrong-answer options for a listen/match/pop/drag activity. Draws only from `taught` (what the
 * child has actually been shown so far) so a game never asks them to pick between letters/words
 * they've never seen; `all` (the whole course) is a fallback only for the very first lesson or
 * two, where too few letters have been taught yet to fill the option count on their own.
 */
function distractors(target: string, taught: string[], all: string[], count: number, rng: () => number, prefer: string[] = []): string[] {
  const preferred = pickDistinct(prefer, count, rng, [target]);
  const known = pickDistinct(taught, count - preferred.length, rng, [target, ...preferred]);
  const chosen = [...preferred, ...known];
  if (chosen.length >= count) return chosen;
  return [...chosen, ...pickDistinct(all, count - chosen.length, rng, [target, ...chosen])];
}

function withOptions(target: string, taught: string[], all: string[], n: number, rng: () => number, prefer: string[]): string[] {
  return shuffle([target, ...distractors(target, taught, all, n - 1, rng, prefer)], rng);
}

const validate = (a: Activity): Activity => activitySchema.parse(a);

export interface BuiltLesson {
  learn: Activity[];
  play: Activity[];
}

/** Learn + Play activities for a lesson node (BRD §5.2). Checkpoints and level tests have neither. */
export function buildLesson(node: JourneyNode, seed = 1): BuiltLesson {
  if (node.kind !== 'lesson') return { learn: [], play: [] };
  const rng = createRng(seed);
  const { newItems, reviewItems } = nodeItems(node);
  const pool = courseItems(node.courseId);
  const taught = taughtItemsUpTo(node);
  const all = pool.map((i) => i.id);
  const learn: Activity[] = [];
  const play: Activity[] = [];

  // A8 Story Card: opens the unit's first lesson with a scene of all its letters (each unit has 2-4
  // lessons, matching the schema's item range), before teaching them one by one.
  if (node.unit.lessons[0]!.id === node.id) {
    const unitItems = node.unit.lessons.flatMap((l) => l.newItems);
    learn.push({ id: `${node.unit.id}-story`, type: 'story_card', phase: 'learn', itemId: unitItems[0]!, items: unitItems });
  }

  for (const id of newItems) {
    const item = getItem(id);
    learn.push({ id: `${node.id}-a1`, type: 'learn_card', phase: 'learn', itemId: id });
    learn.push({ id: `${node.id}-a2`, type: 'trace', phase: 'learn', itemId: id, minAccuracy: 0 });

    const match = [id, ...reviewItems, ...distractors(id, taught, all, 3, rng)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
    const words = wordsContaining(item, pool);
    play.push(
      { id: `${node.id}-a3`, type: 'listen_tap', phase: 'play', itemId: id, options: withOptions(id, taught, all, 3, rng, reviewItems), hints: true },
      { id: `${node.id}-a4`, type: 'match_pairs', phase: 'play', itemId: id, pairs: shuffle(match, rng) },
      { id: `${node.id}-a5`, type: 'drag_drop', phase: 'play', itemId: id, options: withOptions(id, taught, all, 3, rng, reviewItems) },
      { id: `${node.id}-a6`, type: 'pop_balloon', phase: 'play', itemId: id, options: withOptions(id, taught, all, 3, rng, reviewItems), goal: 3 },
      { id: `${node.id}-a7`, type: 'find_letter', phase: 'play', itemId: id, word: words[Math.floor(rng() * words.length)]! },
    );
  }
  return { learn: learn.map(validate), play: play.map(validate) };
}

/**
 * Mastery quiz (Check). Every new item appears at least once; 20–30% older items are mixed in.
 * A different seed regenerates a different mix for the Help Loop retry (FR-13).
 */
export function generateQuiz(node: JourneyNode, seed: number): Activity[] {
  const rng = createRng(seed);
  const { newItems, reviewItems } = nodeItems(node);
  const pool = courseItems(node.courseId);
  const taught = taughtItemsUpTo(node);
  const all = pool.map((i) => i.id);
  const size = node.kind === 'lesson' ? 6 : node.size;
  const hasTrace = node.kind === 'lesson';
  const slots = hasTrace ? size - 1 : size;

  const reviewCount = node.kind === 'lesson' && reviewItems.length > 0 ? Math.round(slots * 0.3) : 0;
  const targets: string[] = [];
  for (let i = 0; targets.length < slots - reviewCount; i++) targets.push(newItems[i % newItems.length]!);
  for (let i = 0; i < reviewCount; i++) targets.push(reviewItems[i % reviewItems.length]!);

  const quiz: Activity[] = shuffle(targets, rng).map((itemId, i) => {
    const id = `${node.id}-q${i + 1}`;
    const item = getItem(itemId);
    const words = wordsContaining(item, pool);
    const useFind = rng() < 0.35 && words.length > 0;
    return useFind
      ? { id, type: 'find_letter', phase: 'check', itemId, word: words[Math.floor(rng() * words.length)]! }
      : { id, type: 'listen_tap', phase: 'check', itemId, options: withOptions(itemId, taught, all, 3, rng, [...newItems, ...reviewItems]), hints: false };
  });
  if (hasTrace) quiz.push({ id: `${node.id}-q${size}`, type: 'trace', phase: 'check', itemId: newItems[0]!, minAccuracy: 0.7 });
  return quiz.map(validate);
}

/** Help Loop (FR-13): re-teach each missed item, then 2–3 targeted practice activities. */
export function buildHelpLoop(node: JourneyNode, missedItems: string[], seed: number): Activity[] {
  const rng = createRng(seed);
  const items = missedItems.slice(0, 3);
  const taught = taughtItemsUpTo(node);
  const all = courseItems(node.courseId).map((i) => i.id);
  const out: Activity[] = [];
  items.forEach((itemId, i) => out.push({ id: `${node.id}-h${i}-learn`, type: 'learn_card', phase: 'learn', itemId }));
  items.forEach((itemId, i) => {
    out.push({ id: `${node.id}-h${i}-tap`, type: 'listen_tap', phase: 'play', itemId, options: withOptions(itemId, taught, all, 3, rng, items), hints: true });
    if (i === 0) out.push({ id: `${node.id}-h${i}-pop`, type: 'pop_balloon', phase: 'play', itemId, options: withOptions(itemId, taught, all, 3, rng, items), goal: 2 });
  });
  return out.map(validate);
}

/**
 * Practice Garden: one quick listen-and-tap per due item, max 8 (about 3 minutes). `known` is
 * every item this child has ever been taught (so distractors never surprise them with a letter
 * they haven't met yet) — the caller passes its own progress record's item keys. `courseId` is
 * only a fallback, for the rare case a child has due review before enough letters are known to
 * fill the option count on their own.
 */
export function buildReview(itemIds: string[], known: string[], courseId: string, seed: number): Activity[] {
  const rng = createRng(seed);
  const all = courseItems(courseId).map((i) => i.id);
  return itemIds.slice(0, 8).map((itemId, i) =>
    validate({ id: `review-${i}`, type: 'listen_tap', phase: 'check', itemId, options: withOptions(itemId, known, all, 3, rng, itemIds), hints: true }),
  );
}
