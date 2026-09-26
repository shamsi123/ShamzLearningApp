import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { ActivityOf } from '@/content/schema';
import LearnCard from './learn_card/LearnCard';
import ListenTap from './listen_tap/ListenTap';
import FindLetter from './find_letter/FindLetter';
import MatchPairs from './match_pairs/MatchPairs';
import PopBalloon from './pop_balloon/PopBalloon';
import DragDrop from './drag_drop/DragDrop';
import TraceLetter from './trace/TraceLetter';
import StoryCard from './story_card/StoryCard';

vi.mock('@/engine/audio', () => ({
  sfx: vi.fn(),
  speak: vi.fn(),
  speakAll: vi.fn(),
  speakWithHighlight: vi.fn(),
  speakWithLetterHighlight: vi.fn(),
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const flush = () => act(() => vi.advanceTimersByTime(1000));

const BA = 'ar-letter-ba';
const TA = 'ar-letter-ta';
const ALIF = 'ar-letter-alif';

describe('LearnCard', () => {
  it('shows the letter, example word and position forms, then continues', () => {
    const onDone = vi.fn();
    render(<LearnCard activity={{ id: 'x', type: 'learn_card', phase: 'learn', itemId: BA }} onDone={onDone} />);
    expect(screen.getByTestId('example-word').textContent?.replace(/‍/g, '')).toBe('بَطَّة');
    expect(screen.getByText('start')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(onDone).toHaveBeenCalledWith({ correct: true });
  });

  it('highlights the isolated letter green for exactly as long as it is spoken', async () => {
    const { speakWithHighlight } = await import('@/engine/audio');
    render(<LearnCard activity={{ id: 'x', type: 'learn_card', phase: 'learn', itemId: BA }} onDone={vi.fn()} />);
    const glyph = screen.getByTestId('big-glyph');
    expect(glyph.className).not.toContain('text-leaf-500');

    fireEvent.click(screen.getByRole('button', { name: 'Ba' }));
    const [, , onStart, onEnd] = vi.mocked(speakWithHighlight).mock.calls.at(-1)!;
    act(() => onStart());
    expect(glyph.className).toContain('text-leaf-500');
    act(() => onEnd());
    expect(glyph.className).not.toContain('text-leaf-500');
  });

  it('highlights the example word one letter at a time as it is spoken (harakat stay attached to their base letter)', async () => {
    const { speakWithLetterHighlight } = await import('@/engine/audio');
    render(<LearnCard activity={{ id: 'x', type: 'learn_card', phase: 'learn', itemId: BA }} onDone={vi.fn()} />);
    const word = screen.getByTestId('example-word');
    expect(word.textContent?.replace(/‍/g, '')).toBe('بَطَّة');
    const letters = word.querySelectorAll('span');
    expect(letters.length).toBe(3); // ب / طّ / ة — each cluster is one base letter plus its harakat

    fireEvent.click(word);
    const [, , , onIndex, onEnd] = vi.mocked(speakWithLetterHighlight).mock.calls.at(-1)!;
    act(() => onIndex(0));
    expect(letters[0]!.className).toContain('text-leaf-500');
    expect(letters[1]!.className).not.toContain('text-leaf-500');
    act(() => onIndex(1));
    expect(letters[0]!.className).not.toContain('text-leaf-500');
    expect(letters[1]!.className).toContain('text-leaf-500');
    act(() => onEnd());
    expect(letters[1]!.className).not.toContain('text-leaf-500');
  });
});

describe('StoryCard', () => {
  it('speaks each tapped item and continues on tap', () => {
    const onDone = vi.fn();
    render(<StoryCard activity={{ id: 'x', type: 'story_card', phase: 'learn', itemId: BA, items: [BA, TA, ALIF] }} onDone={onDone} />);
    expect(screen.getAllByRole('button')).toHaveLength(4); // 3 items + Continue
    fireEvent.click(screen.getByTestId(`story-item-${BA}`));
    expect(screen.getByTestId(`story-item-${BA}`).className).toContain('ring-sky2-400');
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onDone).toHaveBeenCalledWith({ correct: true });
  });
});

describe('ListenTap', () => {
  const play: ActivityOf<'listen_tap'> = { id: 'x', type: 'listen_tap', phase: 'play', itemId: BA, options: [BA, TA, ALIF], hints: true };

  it('correct first tap counts as correct', () => {
    const onDone = vi.fn();
    render(<ListenTap activity={play} onDone={onDone} />);
    fireEvent.click(screen.getByTestId(`option-${BA}`));
    expect(screen.getByText(/Great job/)).toBeInTheDocument();
    flush();
    expect(onDone).toHaveBeenCalledWith({ correct: true });
  });

  it('a wrong tap says "Try again" and the later correct answer is not first-try', () => {
    const onDone = vi.fn();
    render(<ListenTap activity={play} onDone={onDone} />);
    fireEvent.click(screen.getByTestId(`option-${TA}`));
    expect(screen.getByText(/Try again/)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(`option-${BA}`));
    flush();
    expect(onDone).toHaveBeenCalledWith({ correct: false });
  });

  it('highlights the answer as a hint after two misses in play', () => {
    render(<ListenTap activity={play} onDone={vi.fn()} />);
    fireEvent.click(screen.getByTestId(`option-${TA}`));
    fireEvent.click(screen.getByTestId(`option-${ALIF}`));
    expect(screen.getByText(/Here's a clue/)).toBeInTheDocument();
    expect(screen.getByTestId(`option-${BA}`).className).toContain('ring-sun-400');
  });

  it('in the check the first answer counts and there are no hints', () => {
    const onDone = vi.fn();
    render(<ListenTap activity={{ ...play, phase: 'check', hints: false }} onDone={onDone} />);
    fireEvent.click(screen.getByTestId(`option-${TA}`));
    expect(screen.queryByText(/Here's a clue/)).not.toBeInTheDocument();
    flush();
    expect(onDone).toHaveBeenCalledWith({ correct: false });
  });
});

describe('FindLetter', () => {
  // "بطة" — ba is the first (rightmost) letter
  const act1: ActivityOf<'find_letter'> = { id: 'x', type: 'find_letter', phase: 'play', itemId: BA, word: 'بطة' };

  it('renders the word as joined segments (ZWJ keeps the connected forms)', () => {
    render(<FindLetter activity={act1} onDone={vi.fn()} />);
    expect(screen.getByTestId('seg-0').textContent).toBe('ب‍');
    expect(screen.getByTestId('seg-1').textContent).toBe('‍ط‍');
  });

  it('correct tap completes; wrong taps then correct is not first-try; hint after two misses', () => {
    const onDone = vi.fn();
    render(<FindLetter activity={act1} onDone={onDone} />);
    fireEvent.click(screen.getByTestId('seg-1'));
    fireEvent.click(screen.getByTestId('seg-2'));
    expect(screen.getByText(/Here's a clue/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('seg-0'));
    flush();
    expect(onDone).toHaveBeenCalledWith({ correct: false });
  });

  it('first-try correct', () => {
    const onDone = vi.fn();
    render(<FindLetter activity={act1} onDone={onDone} />);
    fireEvent.click(screen.getByTestId('seg-0'));
    flush();
    expect(onDone).toHaveBeenCalledWith({ correct: true });
  });
});

describe('MatchPairs', () => {
  const pairs: ActivityOf<'match_pairs'> = { id: 'x', type: 'match_pairs', phase: 'play', itemId: BA, pairs: [BA, TA] };

  it('matching every pair without mistakes is correct', () => {
    const onDone = vi.fn();
    render(<MatchPairs activity={pairs} onDone={onDone} />);
    fireEvent.click(screen.getByTestId(`letter-${BA}`));
    fireEvent.click(screen.getByTestId(`picture-${BA}`));
    fireEvent.click(screen.getByTestId(`picture-${TA}`));
    fireEvent.click(screen.getByTestId(`letter-${TA}`));
    flush();
    expect(onDone).toHaveBeenCalledWith({ correct: true });
  });

  it('a mismatch says "Try again" and marks the result as not first-try', () => {
    const onDone = vi.fn();
    render(<MatchPairs activity={pairs} onDone={onDone} />);
    fireEvent.click(screen.getByTestId(`letter-${BA}`));
    fireEvent.click(screen.getByTestId(`picture-${TA}`));
    expect(screen.getByText(/Try again/)).toBeInTheDocument();
    for (const id of [BA, TA]) {
      fireEvent.click(screen.getByTestId(`letter-${id}`));
      fireEvent.click(screen.getByTestId(`picture-${id}`));
    }
    flush();
    expect(onDone).toHaveBeenCalledWith({ correct: false });
  });
});

describe('PopBalloon', () => {
  const pop: ActivityOf<'pop_balloon'> = { id: 'x', type: 'pop_balloon', phase: 'play', itemId: BA, options: [BA, TA], goal: 2 };

  it('popping the target balloons completes; popping others says try again', () => {
    const onDone = vi.fn();
    render(<PopBalloon activity={pop} onDone={onDone} />);
    fireEvent.click(screen.getAllByTestId(`balloon-${TA}`)[0]!);
    expect(screen.getByText(/Try again/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId(`balloon-${BA}`)[0]!);
    fireEvent.click(screen.getAllByTestId(`balloon-${BA}`)[0]!);
    flush();
    expect(onDone).toHaveBeenCalledWith({ correct: false });
  });

  it('clean run is correct', () => {
    const onDone = vi.fn();
    render(<PopBalloon activity={pop} onDone={onDone} />);
    fireEvent.click(screen.getAllByTestId(`balloon-${BA}`)[0]!);
    expect(screen.getByText('1 more')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId(`balloon-${BA}`)[0]!);
    flush();
    expect(onDone).toHaveBeenCalledWith({ correct: true });
  });
});

describe('DragDrop', () => {
  it('renders the pictured word, the basket and a draggable tile per option', () => {
    render(<DragDrop activity={{ id: 'x', type: 'drag_drop', phase: 'play', itemId: BA, options: [BA, TA, ALIF] }} onDone={vi.fn()} />);
    expect(screen.getByTestId('basket')).toHaveTextContent('بَطَّة');
    expect(screen.getAllByTestId(/^tile-/)).toHaveLength(3);
    // Dragging itself is covered by the Playwright walkthrough (pointer sensors need a real layout).
  });
});

describe('TraceLetter', () => {
  const draw = () => {
    const canvas = screen.getByTestId('trace-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
  };

  beforeEach(() => {
    // jsdom has no canvas: stub a context whose glyph mask covers the whole grid.
    const ctx = new Proxy({}, {
      get: (_t, prop) =>
        prop === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }) : () => undefined,
      set: () => true,
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  });

  it('a tiny scribble does not pass the check threshold', () => {
    const onDone = vi.fn();
    render(<TraceLetter activity={{ id: 'x', type: 'trace', phase: 'check', itemId: BA, minAccuracy: 0.7 }} onDone={onDone} />);
    expect(screen.getByRole('button', { name: /I'm done/ })).toBeDisabled();
    draw();
    fireEvent.click(screen.getByRole('button', { name: /I'm done/ }));
    flush();
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });

  it('in play a low score asks to trace again instead of finishing', () => {
    const onDone = vi.fn();
    render(<TraceLetter activity={{ id: 'x', type: 'trace', phase: 'play', itemId: BA, minAccuracy: 0.7 }} onDone={onDone} />);
    draw();
    fireEvent.click(screen.getByRole('button', { name: /I'm done/ }));
    expect(screen.getByText(/Try again/)).toBeInTheDocument();
    flush();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('in learn any tracing is praised', () => {
    const onDone = vi.fn();
    render(<TraceLetter activity={{ id: 'x', type: 'trace', phase: 'learn', itemId: BA, minAccuracy: 0 }} onDone={onDone} />);
    draw();
    fireEvent.click(screen.getByRole('button', { name: /I'm done/ }));
    flush();
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
  });
});
