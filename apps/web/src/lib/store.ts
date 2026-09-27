import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { findNode, masteryFor, nodeItems } from '@/content/course';
import { review } from '@/engine/leitner';
import { evaluateMastery, type ItemResult, type MasteryResult } from '@/engine/mastery';
import { enqueue, flush, newId } from '@/offline/syncQueue';
import type { UiLang } from '@/i18n';
import * as api from './api';
import { emptyChildData, localDate, touchStreak, type ChildData, type LessonSession } from './progress';

export interface Parent {
  email: string;
  passwordHash: string;
  consentGivenAt: string;
  createdAt: string;
}

export interface Child {
  id: string;
  nickname: string;
  ageBand: '4-6' | '7-10';
  avatar: { animal: string; color: string; item: string };
  pinHash: string | null;
  courses: string[];
  createdAt: string;
}

export interface ChildSettings {
  sound: boolean;
  music: boolean;
  dailyLimitMinutes: number;
  quietHours: { start: string; end: string } | null;
  uiLang: UiLang;
  highContrast: boolean;
}

export const defaultSettings = (): ChildSettings => ({
  sound: true,
  music: true,
  // No screen-time limit by default — a parent turns one on for their own child from the parent
  // dashboard's settings (0 means unlimited; see useBreakReason).
  dailyLimitMinutes: 0,
  quietHours: null,
  uiLang: 'en',
  highContrast: false,
});

/** Backend session (services/api). Null means the app runs fully local/offline — see `lib/api.ts`. */
export interface BackendAuth {
  access: string;
  refresh: string;
}

/** Only this account can enroll caregivers (checked against the real, already-registered parent login). */
export const ADMIN_EMAIL = 'shamsisr@gmail.com';

export interface EnrolledMember {
  email: string;
  pinHash: string;
  enrolledAt: string;
}

interface PendingEnrollment {
  code: string;
  createdAt: string;
}

const ENROLLMENT_CODE_TTL_MS = 30 * 60 * 1000;

interface State {
  parent: Parent | null;
  parentSignedIn: boolean;
  backendAuth: BackendAuth | null;
  children: Child[];
  activeChildId: string | null;
  data: Record<string, ChildData>;
  settings: Record<string, ChildSettings>;
  /** Caregivers the admin has enrolled for quick PIN sign-in on this device (keyed by lowercase email). */
  enrolledMembers: Record<string, EnrolledMember>;
  pendingEnrollments: Record<string, PendingEnrollment>;

  /**
   * Local-first auth (works fully offline). When `VITE_API_URL` is configured, both also make a
   * best-effort call to the real backend (services/api) and store its tokens on success; a failed
   * or unreachable backend never blocks the local account — see docs/SCREENS.md's placeholder table.
   */
  registerParent(email: string, password: string): Promise<void>;
  signIn(email: string, password: string): Promise<boolean>;
  /** One-tap access for the site owner/tester: no email, no backend call, purely local. */
  adminSignIn(): void;
  /**
   * Admin-only (FR: caregiver enrollment). Generates a one-time numeric code for `email`, valid 30
   * minutes; the admin shares it with the caregiver by whatever channel they like (there's no email
   * sending — this app has no backend deployed to send it from). Returns the code.
   */
  startEnrollment(email: string): string;
  /** The caregiver's half: redeems the code and sets the PIN they'll sign in with from now on. */
  verifyEnrollment(email: string, code: string, pin: string): Promise<boolean>;
  /** Caregiver sign-in with email + PIN, in place of the admin's email + password. */
  memberSignIn(email: string, pin: string): Promise<boolean>;
  signOut(): void;
  addChild(child: Omit<Child, 'id' | 'createdAt'>): string;
  updateChild(id: string, patch: Partial<Omit<Child, 'id'>>): void;
  deleteChild(id: string): void;
  selectChild(id: string | null): void;
  updateSettings(childId: string, patch: Partial<ChildSettings>): void;

  setSession(session: LessonSession | null): void;
  /** Queues the attempt for sync; `schedule` also moves the item between Leitner boxes. */
  recordAnswer(activityId: string, itemId: string, correct: boolean, schedule?: boolean): void;
  completeCheck(nodeId: string, results: ItemResult[], traceAccuracy: number | null): MasteryResult;
  addMinute(): void;
  waterGarden(): void;
  overrideUnlock(childId: string, nodeId: string): void;
  assignExtraReview(childId: string, itemIds: string[]): void;

  /** Sends every queued attempt batch to the backend (FR-42). No-op offline or signed out locally-only. */
  flushQueue(): Promise<void>;
}

export async function hashSecret(secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(`kidslang:${secret}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const patchChild = (state: State, fn: (d: ChildData) => ChildData): Partial<State> => {
  const id = state.activeChildId;
  if (!id) return {};
  return { data: { ...state.data, [id]: fn(state.data[id] ?? emptyChildData()) } };
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      parent: null,
      parentSignedIn: false,
      backendAuth: null,
      children: [],
      activeChildId: null,
      data: {},
      settings: {},
      enrolledMembers: {},
      pendingEnrollments: {},

      registerParent: async (email, password) => {
        const passwordHash = await hashSecret(password);
        const cleanEmail = email.trim().toLowerCase();
        set({
          parent: { email: cleanEmail, passwordHash, consentGivenAt: new Date().toISOString(), createdAt: new Date().toISOString() },
          parentSignedIn: true,
        });
        if (!api.apiEnabled) return;
        try {
          const auth = await api.register(cleanEmail, password, true);
          set({ backendAuth: { access: auth.accessToken, refresh: auth.refreshToken } });
        } catch {
          // Offline, API down, or this email is already registered server-side from elsewhere.
          // The local account still works — see the "web app doesn't call the API yet" note in docs/SCREENS.md.
        }
      },

      signIn: async (email, password) => {
        const passwordHash = await hashSecret(password);
        const cleanEmail = email.trim().toLowerCase();
        const p = get().parent;
        const ok = !!p && p.email === cleanEmail && p.passwordHash === passwordHash;
        if (ok) set({ parentSignedIn: true });
        // The local record alone decides `ok`: this device may be offline, or may never have seen a
        // parent who registered on another device — cross-device login isn't supported in this pass.
        if (api.apiEnabled) {
          try {
            const auth = await api.login(cleanEmail, password);
            set({ backendAuth: { access: auth.accessToken, refresh: auth.refreshToken } });
          } catch {
            /* backend unreachable or credentials differ there; local result still governs sign-in */
          }
        }
        return ok;
      },

      // Reuses the same local parent record on every tap so repeat visits keep the same children/progress.
      adminSignIn: () =>
        set((s) => ({
          parent: s.parent ?? { email: 'admin@local', passwordHash: '', consentGivenAt: new Date().toISOString(), createdAt: new Date().toISOString() },
          parentSignedIn: true,
        })),

      startEnrollment: (email) => {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const cleanEmail = email.trim().toLowerCase();
        set((s) => ({ pendingEnrollments: { ...s.pendingEnrollments, [cleanEmail]: { code, createdAt: new Date().toISOString() } } }));
        return code;
      },

      verifyEnrollment: async (email, code, pin) => {
        const cleanEmail = email.trim().toLowerCase();
        const pending = get().pendingEnrollments[cleanEmail];
        if (!pending || pending.code !== code.trim()) return false;
        if (Date.now() - Date.parse(pending.createdAt) > ENROLLMENT_CODE_TTL_MS) return false;
        const pinHash = await hashSecret(pin);
        set((s) => {
          const pendingEnrollments = { ...s.pendingEnrollments };
          delete pendingEnrollments[cleanEmail];
          return {
            pendingEnrollments,
            enrolledMembers: { ...s.enrolledMembers, [cleanEmail]: { email: cleanEmail, pinHash, enrolledAt: new Date().toISOString() } },
          };
        });
        return true;
      },

      memberSignIn: async (email, pin) => {
        const cleanEmail = email.trim().toLowerCase();
        const member = get().enrolledMembers[cleanEmail];
        if (!member) return false;
        const pinHash = await hashSecret(pin);
        if (pinHash !== member.pinHash) return false;
        // Unlocks the same local family account an admin already set up here, mirroring adminSignIn's
        // fallback — enrollment always happens on a device that already has that account, but this
        // keeps a caregiver from being locked out if storage was ever cleared.
        set((s) => ({
          parent: s.parent ?? { email: cleanEmail, passwordHash: '', consentGivenAt: new Date().toISOString(), createdAt: new Date().toISOString() },
          parentSignedIn: true,
        }));
        return true;
      },

      signOut: () => set({ parentSignedIn: false, activeChildId: null, backendAuth: null }),

      addChild: (child) => {
        const id = newId();
        set((s) => ({
          children: [...s.children, { ...child, id, createdAt: new Date().toISOString() }],
          data: { ...s.data, [id]: emptyChildData() },
          settings: { ...s.settings, [id]: defaultSettings() },
        }));
        // Mirrors the offline-created profile to the backend under the same id (idempotent there too),
        // so later quiz/attempt syncs for this child have a row to attach to. Best-effort, non-blocking.
        if (api.apiEnabled && get().backendAuth) {
          void api
            .createChild({ id, nickname: child.nickname, ageBand: child.ageBand, avatar: child.avatar, picturePinHash: child.pinHash })
            .catch(() => {});
        }
        return id;
      },
      updateChild: (id, patch) => set((s) => ({ children: s.children.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      // FR-05: deleting a profile removes all of its data (progress, attempts, rewards, logs).
      deleteChild: (id) => {
        set((s) => {
          const data = { ...s.data };
          const settings = { ...s.settings };
          delete data[id];
          delete settings[id];
          return { children: s.children.filter((c) => c.id !== id), data, settings, activeChildId: s.activeChildId === id ? null : s.activeChildId };
        });
        if (api.apiEnabled && get().backendAuth) void api.deleteChild(id).catch(() => {});
      },
      selectChild: (id) => set({ activeChildId: id }),
      updateSettings: (childId, patch) =>
        set((s) => ({ settings: { ...s.settings, [childId]: { ...(s.settings[childId] ?? defaultSettings()), ...patch } } })),

      setSession: (session) =>
        set((s) =>
          patchChild(s, (d) => {
            const lessons = { ...d.lessons };
            if (session && !lessons[session.nodeId]) lessons[session.nodeId] = { status: 'in_progress', bestScore: 0, stars: 0, attempts: 0 };
            return { ...d, session, lessons };
          }),
        ),

      recordAnswer: (activityId, itemId, correct, schedule = false) =>
        set((s) =>
          patchChild(s, (d) => {
            const now = new Date();
            const lessonId = d.session?.nodeId ?? 'review';
            return {
              ...d,
              items: schedule ? { ...d.items, [itemId]: review(d.items[itemId], correct, now) } : d.items,
              streak: touchStreak(d.streak, now),
              queue: enqueue(d.queue, {
                id: newId(), childId: s.activeChildId!, activityId, lessonId, itemId, isCorrect: correct, createdAtUtc: now.toISOString(),
              }),
            };
          }),
        ),

      completeCheck: (nodeId, results, traceAccuracy) => {
        const node = findNode(nodeId);
        if (!node) throw new Error(`Unknown node ${nodeId}`);
        const { newItems } = nodeItems(node);
        const result = evaluateMastery({ newItems, config: masteryFor(node), results, traceAccuracy });
        set((s) =>
          patchChild(s, (d) => {
            const prev = d.lessons[nodeId] ?? { status: 'in_progress' as const, bestScore: 0, stars: 0, attempts: 0 };
            const wasMastered = prev.status === 'mastered';
            const mastered = wasMastered || result.mastered;
            // Leitner: one step per item per quiz — up only if every answer for it was correct.
            const items = { ...d.items };
            const now = new Date();
            for (const id of new Set(results.map((r) => r.itemId))) {
              items[id] = review(items[id], results.filter((r) => r.itemId === id).every((r) => r.correct), now);
            }
            let stickers = d.stickers;
            let trophies = d.trophies;
            if (result.mastered && node.kind === 'checkpoint' && !stickers.includes(node.unit.id)) stickers = [...stickers, node.unit.id];
            if (result.mastered && node.kind === 'level_test' && !trophies.includes(node.levelId)) trophies = [...trophies, node.levelId];
            return {
              ...d,
              items,
              stickers,
              trophies,
              lessons: {
                ...d.lessons,
                [nodeId]: {
                  ...prev,
                  status: mastered ? 'mastered' : 'in_progress',
                  bestScore: Math.max(prev.bestScore, result.score),
                  stars: Math.max(prev.stars, result.stars),
                  attempts: prev.attempts + 1,
                  masteredAt: prev.masteredAt ?? (result.mastered ? new Date().toISOString() : undefined),
                },
              },
            };
          }),
        );

        // The server is the source of truth for unlocks (FR-12): it recomputes mastery from the same
        // results with the mirrored C# engine and can confirm an unlock the client missed (e.g. an older
        // client build with a stricter local engine). We only ever upgrade from this reply, never
        // silently revoke a mastered lesson the child already saw and celebrated — a revoke needs a
        // deliberate, gentle UI of its own, which is future work.
        const childId = get().activeChildId;
        if (api.apiEnabled && get().backendAuth && childId) {
          // A finished quiz is also a natural moment to flush any attempts queued during it.
          void get().flushQueue();
          void api
            .submitQuiz(nodeId, childId, results, traceAccuracy)
            .then((server) => {
              if (server.mastered && !result.mastered) {
                set((s) => {
                  const d = s.data[childId];
                  if (!d) return {};
                  const prev = d.lessons[nodeId] ?? { status: 'in_progress' as const, bestScore: 0, stars: 0, attempts: 0 };
                  return {
                    data: {
                      ...s.data,
                      [childId]: {
                        ...d,
                        lessons: {
                          ...d.lessons,
                          [nodeId]: {
                            ...prev,
                            status: 'mastered',
                            stars: Math.max(prev.stars, server.stars),
                            bestScore: Math.max(prev.bestScore, server.score),
                            masteredAt: prev.masteredAt ?? new Date().toISOString(),
                          },
                        },
                      },
                    },
                  };
                });
              } else if (server.mastered !== result.mastered && import.meta.env.DEV) {
                // Surfaces mastery-engine drift between the TS and C# implementations during development.
                console.warn(`[kidslang] mastery mismatch for ${nodeId}: client=${result.mastered} server=${server.mastered}`);
              }
            })
            .catch(() => {
              /* offline or API down: the provisional local result stands until the next sync */
            });
        }

        return result;
      },

      addMinute: () =>
        set((s) =>
          patchChild(s, (d) => {
            const today = localDate(new Date());
            return { ...d, minutesByDay: { ...d.minutesByDay, [today]: (d.minutesByDay[today] ?? 0) + 1 } };
          }),
        ),
      waterGarden: () =>
        set((s) =>
          patchChild(s, (d) => {
            const today = localDate(new Date());
            return d.gardenWaterings.includes(today) ? d : { ...d, gardenWaterings: [...d.gardenWaterings, today], extraReview: [] };
          }),
        ),
      overrideUnlock: (childId, nodeId) =>
        set((s) => {
          const d = s.data[childId] ?? emptyChildData();
          const prev = d.lessons[nodeId];
          return {
            data: {
              ...s.data,
              [childId]: { ...d, lessons: { ...d.lessons, [nodeId]: { status: prev?.status ?? 'in_progress', bestScore: prev?.bestScore ?? 0, stars: prev?.stars ?? 0, attempts: prev?.attempts ?? 0, unlockedByParent: true } } },
            },
          };
        }),
      assignExtraReview: (childId, itemIds) =>
        set((s) => {
          const d = s.data[childId] ?? emptyChildData();
          return { data: { ...s.data, [childId]: { ...d, extraReview: [...new Set([...d.extraReview, ...itemIds])] } } };
        }),

      flushQueue: async () => {
        if (!api.apiEnabled || !get().backendAuth) return;
        for (const [childId, d] of Object.entries(get().data)) {
          if (d.queue.length === 0) continue;
          const remaining = await flush(d.queue, async (batch) => {
            const res = await api.submitAttemptsBatch(batch.map((a) => ({ ...a, score: null })));
            return { acceptedIds: res.acceptedIds };
          });
          set((s) => {
            const current = s.data[childId];
            if (!current) return {};
            return { data: { ...s.data, [childId]: { ...current, queue: remaining } } };
          });
        }
      },
    }),
    {
      name: 'kidslang',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        parent: s.parent,
        parentSignedIn: s.parentSignedIn,
        backendAuth: s.backendAuth,
        children: s.children,
        activeChildId: s.activeChildId,
        data: s.data,
        settings: s.settings,
        enrolledMembers: s.enrolledMembers,
        pendingEnrollments: s.pendingEnrollments,
      }),
    },
  ),
);

// Keeps the API client's bearer token in sync with the store, including after rehydration from
// localStorage and on sign-out — `api.ts` never imports the store directly (avoids a cycle).
const syncApiTokens = (auth: BackendAuth | null) => api.setTokens(auth ? { access: auth.access, refresh: auth.refresh } : null);
syncApiTokens(useStore.getState().backendAuth);
useStore.subscribe((s, prev) => {
  if (s.backendAuth !== prev.backendAuth) syncApiTokens(s.backendAuth);
});
api.setOnRefresh((tokens) => useStore.setState({ backendAuth: tokens }));

export function useActiveChild() {
  const child = useStore((s) => s.children.find((c) => c.id === s.activeChildId) ?? null);
  const data = useStore((s) => (s.activeChildId ? s.data[s.activeChildId] : undefined)) ?? EMPTY;
  const settings = useStore((s) => (s.activeChildId ? s.settings[s.activeChildId] : undefined)) ?? DEFAULTS;
  return { child, data, settings };
}

const EMPTY = emptyChildData();
const DEFAULTS = defaultSettings();
