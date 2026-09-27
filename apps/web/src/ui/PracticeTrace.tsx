import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { courses } from '@/content/course';
import type { Point } from '@/engine/tracing';

const FONTS: Record<string, (px: number) => string> = {
  ar: (px) => `700 ${px}px "Baloo Bhaijaan 2", "Noto Naskh Arabic", serif`,
  hi: (px) => `700 ${px}px "Baloo 2", "Noto Sans Devanagari", sans-serif`,
};
const GLYPH_SCALE = 0.62;

/**
 * Free tracing practice (no scoring, no pass/fail): a dashed guide letter with a "repaint" button
 * to clear and try again as many times as the child likes. Used on the alphabet overview so every
 * letter has a place to practise writing it, separate from the graded Trace activity in a lesson.
 */
export function PracticeTrace({ glyph, courseId, size = 140 }: { glyph: string; courseId: string; size?: number }) {
  const { t } = useTranslation();
  const font = FONTS[courseId] ?? FONTS.ar!;
  const dir = courses[courseId]?.direction ?? 'ltr';
  const guideRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<Point | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const drawGuide = useCallback(() => {
    const c = guideRef.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, size, size);
    g.font = font(size * GLYPH_SCALE);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = dir;
    g.fillStyle = '#ede9fe';
    g.fillText(glyph, size / 2, size / 2);
    g.setLineDash([5, 7]);
    g.lineWidth = 2;
    g.strokeStyle = '#a78bfa';
    g.strokeText(glyph, size / 2, size / 2);
  }, [glyph, font, dir, size]);

  useEffect(() => {
    drawGuide();
    void document.fonts?.load(font(40), glyph).then(drawGuide);
    const c = inkRef.current;
    if (c) {
      const dpr = window.devicePixelRatio || 1;
      c.width = size * dpr;
      c.height = size * dpr;
      c.getContext('2d')?.scale(dpr, dpr);
    }
  }, [drawGuide, glyph, font, size]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * size, y: ((e.clientY - r.top) / r.height) * size };
  };

  const line = (a: Point, b: Point) => {
    const g = inkRef.current?.getContext('2d');
    if (!g) return;
    g.strokeStyle = '#7c3aed';
    g.lineWidth = size / 9;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  };

  const clear = () => {
    setHasInk(false);
    inkRef.current?.getContext('2d')?.clearRect(0, 0, size, size);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative rounded-2xl bg-white shadow-[0_5px_0_#ddd6fe]" style={{ width: size, height: size }}>
        <canvas ref={guideRef} className="absolute inset-0 h-full w-full" aria-hidden />
        <canvas
          ref={inkRef}
          aria-label={t('alphabet.practice')}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            drawing.current = true;
            const p = pos(e);
            last.current = p;
            line(p, p);
            setHasInk(true);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const p = pos(e);
            if (last.current) line(last.current, p);
            last.current = p;
          }}
          onPointerUp={() => (drawing.current = false)}
          onPointerCancel={() => (drawing.current = false)}
        />
      </div>
      <button
        type="button"
        onClick={clear}
        disabled={!hasInk}
        className="text-sm font-bold text-grape-600 underline underline-offset-2 disabled:opacity-30"
      >
        🔄 {t('alphabet.repaint')}
      </button>
    </div>
  );
}
