import { useTranslation } from 'react-i18next';
import { courseIdOf, directionOf, getItem } from '@/content/course';
import { ScriptText } from '@/ui/ScriptText';
import { Button } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';

/** Help Loop intro (FR-13): friendly, never "failed". Shows the letters we'll practise together. */
export function HelpIntro({ items, mascot, onStart }: { items: string[]; mascot: string; onStart: () => void }) {
  const { t } = useTranslation();
  const dir = items[0] ? directionOf(items[0]) : 'ltr';
  return (
    <div className="flex h-full flex-col items-center justify-between gap-6 bg-gradient-to-b from-sky2-100 to-cream px-6 pb-safe pt-safe">
      <h1 className="mt-8 text-center text-4xl font-extrabold text-grape-700">{t('help.title')}</h1>
      <Mascot emoji={mascot} size="lg" says={t('help.body')} speakLang="en" />
      <div dir={dir} className="flex flex-wrap justify-center gap-3">
        {items.map((id) => (
          <div key={id} className="flex h-24 w-24 items-center justify-center rounded-blob bg-white shadow-[0_6px_0_#bae6fd]">
            <ScriptText courseId={courseIdOf(id)} className="text-6xl">{getItem(id).glyph}</ScriptText>
          </div>
        ))}
      </div>
      <Button block onClick={onStart}>
        🤝 {t('help.start')}
      </Button>
    </div>
  );
}
