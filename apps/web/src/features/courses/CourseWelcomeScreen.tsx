import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { courses } from '@/content/course';
import { useStore } from '@/lib/store';
import { Button } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';
import { ScriptText } from '@/ui/ScriptText';
import { Screen } from '@/ui/Screen';

/**
 * The one-time gate a child sees the very first time they open a course: a short welcome from the
 * mascot, then on to Meet the Alphabet, before ever reaching the lesson journey. Revisiting the
 * course afterwards (`markIntroSeen`) skips straight to the journey map.
 */
export default function CourseWelcomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { courseId = 'ar' } = useParams();
  const markIntroSeen = useStore((s) => s.markIntroSeen);
  const course = courses[courseId];
  if (!course) return <Navigate to="/courses" replace />;

  const languageName = t(`welcome.${courseId === 'ar' ? 'arabic' : 'hindi'}`);

  return (
    <Screen bg="bg-gradient-to-b from-grape-100 via-sun-50 to-cream">
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <ScriptText courseId={courseId} className="text-6xl font-extrabold text-grape-700">{course.title[course.languageCode] ?? course.title.en}</ScriptText>
        <Mascot emoji={course.mascot.emoji} size="lg" says={t('courseWelcome.greeting', { language: languageName })} speakLang="en" />
        <p className="max-w-xs text-lg font-bold text-ink/70">{t('courseWelcome.body')}</p>
        <Button block variant="success" onClick={() => { markIntroSeen(courseId); navigate(`/alphabet/${courseId}`); }}>
          {t('courseWelcome.cta')} →
        </Button>
      </div>
    </Screen>
  );
}
