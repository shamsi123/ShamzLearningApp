import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { courseIdOf, getItem } from '@/content/course';
import { speakWithHighlight, speakWithLetterHighlight } from '@/engine/audio';
import { clusters, positionForms } from '@/lib/arabic';
import { Button } from '@/ui/Button';
import { ScriptText } from '@/ui/ScriptText';
import type { ActivityProps } from '../types';

/** Learn: sound, name, shape (Arabic only — other scripts don't reshape by position) and an
 * example word with a picture (BRD §5.2). */
export default function LearnCard({ activity, onDone }: ActivityProps<'learn_card'>) {
  const { t } = useTranslation();
  const item = getItem(activity.itemId);
  const courseId = courseIdOf(item.id);
  const forms = courseId === 'ar' ? positionForms(item.glyph) : null;
  const order = ['isolated', 'initial', 'medial', 'final'] as const;
  // Highlights green for exactly as long as it's being spoken, so the child can see which shape
  // the sound belongs to. The isolated letter is a single glyph, so it glows as one piece; the
  // example word is split into clusters (a base letter plus any combining marks riding on it, from
  // lib/arabic's clusters()) so it can glow one letter at a time as it's pronounced, without ever
  // separating a mark from its base letter into a sibling element.
  const [glowLetter, setGlowLetter] = useState(false);
  const wordClusters = useMemo(() => clusters(item.example.word, courseId === 'ar'), [item.example.word, courseId]);
  const [wordIndex, setWordIndex] = useState<number | null>(null);

  return (
    <div data-testid="learn-card" className="flex flex-col items-center gap-4 pb-4">
      <button
        type="button"
        aria-label={item.name.en}
        onClick={() =>
          speakWithHighlight(item.name[courseId]!, courseId as 'ar' | 'hi', () => setGlowLetter(true), () => setGlowLetter(false))
        }
        className="flex h-44 w-44 items-center justify-center rounded-full bg-white shadow-[0_8px_0_#ddd6fe] animate-pop-in active:translate-y-1"
      >
        <ScriptText courseId={courseId} data-testid="big-glyph" className={`text-[7rem] leading-none transition-colors ${glowLetter ? 'text-leaf-500' : 'text-grape-700'}`}>
          {item.glyph}
        </ScriptText>
      </button>
      <div className="text-center">
        <ScriptText courseId={courseId} className="text-4xl font-bold">{item.name[courseId]}</ScriptText>
        <div className="text-lg font-bold text-grape-600">
          {item.name.en} · /{item.translit}/
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          speakWithLetterHighlight(item.example.word, courseId as 'ar' | 'hi', wordClusters, setWordIndex, () => setWordIndex(null))
        }
        className="flex w-full items-center justify-between gap-3 rounded-blob bg-sun-100 px-5 py-3 active:scale-95"
      >
        <span className="text-6xl">{item.example.emoji}</span>
        <span className="flex flex-col items-end">
          <ScriptText courseId={courseId} data-testid="example-word" className="text-5xl font-bold text-ink">
            {wordClusters.map((c, i) => (
              <span key={i} className={`transition-colors ${wordIndex === i ? 'text-leaf-500' : ''}`}>
                {c.display}
              </span>
            ))}
          </ScriptText>
          <span className="text-base font-bold text-ink/60">{t('act.learn.word', { name: item.name.en, meaning: item.example.meaning })}</span>
        </span>
      </button>

      {forms && (
        <div className="w-full">
          <p className="mb-2 text-center text-sm font-bold uppercase tracking-wide text-ink/50">{t('act.learn.forms')}</p>
          <div dir="rtl" className="grid grid-cols-4 gap-2">
            {order.map((k) => (
              <div key={k} className="flex flex-col items-center rounded-2xl bg-white py-2 shadow-sm">
                <ScriptText courseId={courseId} className="text-4xl leading-tight">{forms[k]}</ScriptText>
                <span className="text-xs font-bold text-ink/50">{t(`act.learn.${k}`)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button block onClick={() => onDone({ correct: true })}>
        {t('common.next')} <span className="rtl:-scale-x-100">➡️</span>
      </Button>
    </div>
  );
}
