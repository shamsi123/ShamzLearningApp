import arabicCourseJson from '@content/arabic/level-1/course.json';
import arabicItemsJson from '@content/arabic/level-1/items.json';
import hindiCourseJson from '@content/hindi/level-1/course.json';
import hindiItemsJson from '@content/hindi/level-1/items.json';
import { courseSchema, itemsFileSchema, type CourseDef, type LearningItem, type LessonDef, type UnitDef } from './schema';
import { DEFAULT_MASTERY, type MasteryConfig } from '@/engine/mastery';

export const arabicCourse: CourseDef = courseSchema.parse(arabicCourseJson);
export const arabicItems: LearningItem[] = itemsFileSchema.parse(arabicItemsJson).items;
export const hindiCourse: CourseDef = courseSchema.parse(hindiCourseJson);
export const hindiItems: LearningItem[] = itemsFileSchema.parse(hindiItemsJson).items;

export const courses: Record<string, CourseDef> = { ar: arabicCourse, hi: hindiCourse };
const itemsByCourse: Record<string, LearningItem[]> = { ar: arabicItems, hi: hindiItems };
const itemIndex = new Map([...arabicItems, ...hindiItems].map((i) => [i.id, i]));

/** The course an item (or lesson/unit/checkpoint id) belongs to — every id is namespaced `<courseId>-...`. */
export function courseIdOf(id: string): string {
  return id.slice(0, id.indexOf('-'));
}

/** Reading direction for an item's script, straight from its course's own content. */
export function directionOf(id: string): 'rtl' | 'ltr' {
  return courses[courseIdOf(id)]?.direction ?? 'ltr';
}

export function getItem(id: string): LearningItem {
  const item = itemIndex.get(id);
  if (!item) throw new Error(`Unknown learning item ${id}`);
  return item;
}

export function courseItems(courseId: string): LearningItem[] {
  return itemsByCourse[courseId] ?? [];
}

/** A node on the journey path: a lesson, a unit checkpoint, or the level test. */
export type JourneyNode =
  | { kind: 'lesson'; id: string; courseId: string; unit: UnitDef; lesson: LessonDef; order: number }
  | { kind: 'checkpoint'; id: string; courseId: string; unit: UnitDef; size: number; order: number }
  | { kind: 'level_test'; id: string; courseId: string; levelId: string; size: number; order: number };

export function journeyNodes(courseId: string): JourneyNode[] {
  const course = courses[courseId];
  if (!course) return [];
  const nodes: JourneyNode[] = [];
  let order = 0;
  for (const level of course.levels) {
    for (const unit of level.units) {
      for (const lesson of unit.lessons) nodes.push({ kind: 'lesson', id: lesson.id, courseId, unit, lesson, order: order++ });
      nodes.push({ kind: 'checkpoint', id: unit.checkpoint.id, courseId, unit, size: unit.checkpoint.size, order: order++ });
    }
    nodes.push({ kind: 'level_test', id: level.levelTest.id, courseId, levelId: level.id, size: level.levelTest.size, order: order++ });
  }
  return nodes;
}

export function findNode(nodeId: string): JourneyNode | undefined {
  for (const courseId of Object.keys(courses)) {
    const node = journeyNodes(courseId).find((n) => n.id === nodeId);
    if (node) return node;
  }
  return undefined;
}

export function nodeItems(node: JourneyNode): { newItems: string[]; reviewItems: string[] } {
  if (node.kind === 'lesson') return { newItems: node.lesson.newItems, reviewItems: node.lesson.reviewItems };
  if (node.kind === 'checkpoint') return { newItems: node.unit.lessons.flatMap((l) => l.newItems), reviewItems: [] };
  const course = courses[node.courseId]!;
  const level = course.levels.find((l) => l.id === node.levelId)!;
  return { newItems: level.units.flatMap((u) => u.lessons.flatMap((l) => l.newItems)), reviewItems: [] };
}

/**
 * Every item taught up to and including this node (a lesson's own new items count as taught once
 * it reaches Play, since Learn already showed them first). Used so distractor/option pools never
 * include a letter the child hasn't been introduced to yet.
 */
export function taughtItemsUpTo(node: JourneyNode): string[] {
  const items: string[] = [];
  for (const n of journeyNodes(node.courseId)) {
    if (n.kind !== 'lesson' || n.order > node.order) continue;
    items.push(...n.lesson.newItems);
  }
  return items;
}

export function masteryFor(node: JourneyNode): MasteryConfig {
  const course = courses[node.courseId];
  const base = course?.defaultMastery ?? DEFAULT_MASTERY;
  if (node.kind !== 'lesson') return { ...base, requireEachNewItem: false };
  return { ...base, ...node.lesson.mastery };
}

export function nodeTitle(node: JourneyNode, lang: string): string {
  if (node.kind === 'lesson') return node.lesson.title[lang]!;
  if (node.kind === 'checkpoint') return node.unit.title[lang]!;
  return courses[node.courseId]!.levels.find((l) => l.id === node.levelId)!.title[lang]!;
}
