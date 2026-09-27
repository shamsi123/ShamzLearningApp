import type { HTMLAttributes } from 'react';
import { courses } from '@/content/course';

/** Renders course content (a glyph, a word) in the right font and direction for its course's script. */
export function ScriptText({
  courseId,
  className = '',
  children,
  ...rest
}: { courseId: string } & HTMLAttributes<HTMLSpanElement>) {
  const dir = courses[courseId]?.direction ?? 'ltr';
  return (
    <span lang={courseId} dir={dir} className={`${courseId} ${className}`} {...rest}>
      {children}
    </span>
  );
}
