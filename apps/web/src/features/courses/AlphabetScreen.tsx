import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { courseItems, courses } from '@/content/course';
import type { LearningItem } from '@/content/schema';
import { speak } from '@/engine/audio';
import { Button } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';
import { PracticeTrace } from '@/ui/PracticeTrace';
import { ScriptText } from '@/ui/ScriptText';
import { Screen } from '@/ui/Screen';

// Small enough that 3 letters + gaps fit a 360–390px phone width, and the trace row lines up under it.
const ROW_SIZE = 3;
const TILE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Meet the Alphabet (before/alongside the lesson path): a copybook-style chart — a line of
 * letters, then a matching line of tracing boxes for that same line, then the next line of
 * letters, and so on — so a child can hear (tap to hear each letter's sound) and trace the whole
 * alphabet a few letters at a time, and revisit it any time, not just once at the start.
 */
export default function AlphabetScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { courseId = 'ar' } = useParams();
  const [downloading, setDownloading] = useState(false);
  const course = courses[courseId];
  const items = courseItems(courseId);

  if (!course) return null;
  const rows = chunk(items, ROW_SIZE);

  const say = (item: LearningItem) => speak(item.name[courseId] ?? item.glyph, courseId as 'ar' | 'hi');

  const download = async () => {
    setDownloading(true);
    try {
      const { buildAlphabetWorksheet } = await import('@/lib/alphabetWorksheet');
      const blob = await buildAlphabetWorksheet(
        items.map((i) => i.glyph),
        { title: `${course.title.en} — Alphabet Practice`, instructions: t('alphabet.worksheetInstructions'), rtl: course.direction === 'rtl' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${courseId}-alphabet-practice.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Screen title={t('alphabet.title')} back={() => navigate(-1)} bg="bg-cream">
      <div className="flex justify-center py-3">
        <Mascot emoji={course.mascot.emoji} says={t('alphabet.intro', { count: items.length })} speakLang="en" size="sm" />
      </div>
      <div className="pb-2 text-center">
        <p className="mb-2 text-sm font-bold text-ink/50">{t('alphabet.optionalHint')}</p>
        <Button variant="secondary" disabled={downloading} onClick={() => void download()}>
          {downloading ? `⏳ ${t('alphabet.preparing')}` : `⬇️ ${t('alphabet.download')}`}
        </Button>
      </div>
      <div className="flex flex-col gap-5 pb-8">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div dir={course.direction} className="flex justify-center gap-3">
              {row.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => say(item)}
                  style={{ width: TILE }}
                  className="flex flex-col items-center gap-1 rounded-2xl bg-white py-3 shadow-sm active:scale-95"
                >
                  <ScriptText courseId={courseId} className="text-4xl font-bold text-grape-700">{item.glyph}</ScriptText>
                  <span className="text-lg">🔊</span>
                </button>
              ))}
            </div>
            <div dir={course.direction} className="flex justify-center gap-3">
              {row.map((item) => (
                <PracticeTrace key={item.id} glyph={item.glyph} courseId={courseId} size={TILE} compact />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div dir={course.direction} className="pb-6 text-center">
        <Button block onClick={() => navigate(`/journey/${courseId}`)}>
          {t('alphabet.startLessons')}
        </Button>
      </div>
    </Screen>
  );
}
