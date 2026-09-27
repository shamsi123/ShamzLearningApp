import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { courseItems, courses } from '@/content/course';
import { speak } from '@/engine/audio';
import { Mascot } from '@/ui/Mascot';
import { PracticeTrace } from '@/ui/PracticeTrace';
import { ScriptText } from '@/ui/ScriptText';
import { Screen } from '@/ui/Screen';

/**
 * Meet the Alphabet (before/alongside the lesson path): every letter of the course in order, tap
 * to hear its sound, and a repaintable tracing box under each one to start memorizing its shape —
 * revisitable any time, not just once at the start (FR: alphabet intro + repeated tracing practice).
 */
export default function AlphabetScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { courseId = 'ar' } = useParams();
  const course = courses[courseId];
  const items = courseItems(courseId);

  if (!course) return null;

  return (
    <Screen title={t('alphabet.title')} back="/courses" bg="bg-cream">
      <div className="flex justify-center py-3">
        <Mascot emoji={course.mascot.emoji} says={t('alphabet.intro', { count: items.length })} speakLang="en" size="sm" />
      </div>
      <div className="flex flex-col gap-4 pb-8">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col items-center gap-3 rounded-blob bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => speak(item.name[courseId] ?? item.glyph, courseId as 'ar' | 'hi')}
              className="flex items-center gap-3 rounded-2xl bg-grape-50 px-5 py-2 active:scale-95"
            >
              <ScriptText courseId={courseId} className="text-5xl font-bold text-grape-700">{item.glyph}</ScriptText>
              <span className="text-2xl">🔊</span>
            </button>
            <PracticeTrace glyph={item.glyph} courseId={courseId} />
          </div>
        ))}
      </div>
      <div dir={course.direction} className="pb-6 text-center">
        <button type="button" onClick={() => navigate(`/journey/${courseId}`)} className="font-bold text-grape-600 underline underline-offset-2">
          {t('alphabet.startLessons')}
        </button>
      </div>
    </Screen>
  );
}
