import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { courses, journeyNodes } from '@/content/course';
import { useActiveChild } from '@/lib/store';
import { Avatar } from '@/ui/Avatar';
import { Mascot } from '@/ui/Mascot';
import { ScriptText } from '@/ui/ScriptText';
import { Screen } from '@/ui/Screen';

// Full class strings (not interpolated) so Tailwind's static scanner can see the arbitrary shadow value.
const CARDS: Record<string, { testId: string; className: string; emoji: string; nativeTitle: string; descKey: string }> = {
  ar: {
    testId: 'course-ar',
    className: 'bg-gradient-to-br from-sun-300 to-sun-500 shadow-[0_8px_0_#d97706]',
    emoji: '🐪',
    nativeTitle: 'العربية',
    descKey: 'courses.arabicDesc',
  },
  hi: {
    testId: 'course-hi',
    className: 'bg-gradient-to-br from-leaf-300 to-leaf-500 shadow-[0_8px_0_#16a34a]',
    emoji: '🐘',
    nativeTitle: 'हिन्दी',
    descKey: 'courses.hindiDesc',
  },
};

/** Screen 4 — Course picker: Arabic / Hindi cards with mascots. */
export default function CoursesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { child, data } = useActiveChild();

  return (
    <Screen title={t('courses.title')} back="/profiles" right={child && <Avatar avatar={child.avatar} size={56} />}>
      <div className="flex justify-center py-3">
        <Mascot says={t('courses.titleSpoken')} size="sm" />
      </div>
      <div className="flex flex-col gap-5 pb-6">
        {Object.keys(courses).map((courseId) => {
          const card = CARDS[courseId]!;
          const lessons = journeyNodes(courseId).filter((n) => n.kind === 'lesson');
          const done = lessons.filter((n) => data.lessons[n.id]?.status === 'mastered').length;
          return (
            <div key={courseId} className="flex flex-col gap-2">
              <button
                type="button"
                data-testid={card.testId}
                onClick={() => navigate(`/journey/${courseId}`)}
                className={`relative flex items-center gap-4 overflow-hidden rounded-blob p-5 text-start active:translate-y-1 ${card.className}`}
              >
                <span className="text-8xl">{card.emoji}</span>
                <span className="flex flex-1 flex-col">
                  <ScriptText courseId={courseId} className="text-4xl font-extrabold text-white drop-shadow">{card.nativeTitle}</ScriptText>
                  <span className="text-2xl font-extrabold">{t(`welcome.${courseId === 'ar' ? 'arabic' : 'hindi'}`)}</span>
                  <span className="text-base font-bold opacity-80">{t(card.descKey)}</span>
                  <span className="mt-2 h-3 overflow-hidden rounded-full bg-white/50">
                    <span className="block h-full rounded-full bg-white" style={{ width: `${lessons.length ? (done / lessons.length) * 100 : 0}%` }} />
                  </span>
                  <span className="text-sm font-bold">{t('courses.lessonsDone', { done, total: lessons.length })}</span>
                </span>
              </button>
              <button
                type="button"
                data-testid={`alphabet-${courseId}`}
                onClick={() => navigate(`/alphabet/${courseId}`)}
                className="self-start rounded-full bg-white px-4 py-2 text-sm font-extrabold text-grape-700 shadow-sm active:translate-y-1"
              >
                📖 {t('alphabet.linkFromCourses')}
              </button>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
