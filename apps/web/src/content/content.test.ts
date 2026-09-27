import { arabicCourse, arabicItems, hindiCourse, hindiItems, journeyNodes } from './course';
import { itemsFileSchema, courseSchema } from './schema';
import arabicCourseJson from '@content/arabic/level-1/course.json';
import arabicItemsJson from '@content/arabic/level-1/items.json';
import hindiCourseJson from '@content/hindi/level-1/course.json';
import hindiItemsJson from '@content/hindi/level-1/items.json';

describe('Arabic Level 1 content', () => {
  it('validates against the schemas', () => {
    expect(() => itemsFileSchema.parse(arabicItemsJson)).not.toThrow();
    expect(() => courseSchema.parse(arabicCourseJson)).not.toThrow();
  });

  it('teaches all 28 letters exactly once', () => {
    const taught = arabicCourse.levels.flatMap((l) => l.units.flatMap((u) => u.lessons.flatMap((x) => x.newItems)));
    expect(taught).toHaveLength(28);
    expect(new Set(taught).size).toBe(28);
  });

  it('references only known items and every item has audio', () => {
    const ids = new Set(arabicItems.map((i) => i.id));
    for (const level of arabicCourse.levels)
      for (const unit of level.units)
        for (const lesson of unit.lessons) [...lesson.newItems, ...lesson.reviewItems].forEach((id) => expect(ids).toContain(id));
    arabicItems.forEach((i) => expect(i.audio).toMatch(/^ar\/letters\/.+\.mp3$/));
  });

  it('uses the <lang>-l<level>-u<unit>-l<lesson> id pattern and 8 units', () => {
    expect(arabicCourse.levels[0]!.units).toHaveLength(8);
    journeyNodes('ar')
      .filter((n) => n.kind === 'lesson')
      .forEach((n) => expect(n.id).toMatch(/^ar-l1-u\d-l\d$/));
  });

  it('every example word contains its letter', () => {
    for (const item of arabicItems) {
      const plain = item.example.plain.replace(/[أإآ]/g, 'ا');
      expect(plain).toContain(item.glyph);
    }
  });
});

describe('Hindi Level 1 content', () => {
  it('validates against the schemas', () => {
    expect(() => itemsFileSchema.parse(hindiItemsJson)).not.toThrow();
    expect(() => courseSchema.parse(hindiCourseJson)).not.toThrow();
  });

  it('teaches all 28 letters exactly once', () => {
    const taught = hindiCourse.levels.flatMap((l) => l.units.flatMap((u) => u.lessons.flatMap((x) => x.newItems)));
    expect(taught).toHaveLength(28);
    expect(new Set(taught).size).toBe(28);
  });

  it('references only known items and every item has audio', () => {
    const ids = new Set(hindiItems.map((i) => i.id));
    for (const level of hindiCourse.levels)
      for (const unit of level.units)
        for (const lesson of unit.lessons) [...lesson.newItems, ...lesson.reviewItems].forEach((id) => expect(ids).toContain(id));
    hindiItems.forEach((i) => expect(i.audio).toMatch(/^hi\/letters\/.+\.mp3$/));
  });

  it('uses the <lang>-l<level>-u<unit>-l<lesson> id pattern and 8 units', () => {
    expect(hindiCourse.levels[0]!.units).toHaveLength(8);
    journeyNodes('hi')
      .filter((n) => n.kind === 'lesson')
      .forEach((n) => expect(n.id).toMatch(/^hi-l1-u\d-l\d$/));
  });

  it('every example word contains its letter', () => {
    for (const item of hindiItems) expect(item.example.plain).toContain(item.glyph);
  });
});
