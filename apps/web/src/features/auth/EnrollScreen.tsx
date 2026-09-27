import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ADMIN_EMAIL, useStore } from '@/lib/store';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

const input = 'min-h-tap w-full rounded-2xl border-2 border-grape-200 bg-white px-4 text-lg outline-none focus:border-grape-500';

/** Admin-only: enroll a caregiver for quick PIN sign-in on this device (no email is sent — there's
 * no backend deployed to send it from, so the admin shares the code themselves). */
export default function EnrollScreen() {
  const { t } = useTranslation();
  const signIn = useStore((s) => s.signIn);
  const startEnrollment = useStore((s) => s.startEnrollment);
  const [verified, setVerified] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState('');
  const [issued, setIssued] = useState<{ email: string; code: string; link: string } | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const submitGate = async (e: FormEvent) => {
    e.preventDefault();
    setGateError(null);
    if (adminEmail.trim().toLowerCase() !== ADMIN_EMAIL) return setGateError(t('enroll.notAdmin'));
    if (!(await signIn(adminEmail, adminPassword))) return setGateError(t('enroll.wrongCredentials'));
    setVerified(true);
  };

  const generate = () => {
    const email = memberEmail.trim().toLowerCase();
    if (!email) return;
    const code = startEnrollment(email);
    const link = `${window.location.origin}${import.meta.env.BASE_URL}enroll/verify?email=${encodeURIComponent(email)}&code=${code}`;
    setIssued({ email, code, link });
  };

  const copy = (text: string, which: 'code' | 'link') => {
    void navigator.clipboard?.writeText(text);
    setCopied(which);
    window.setTimeout(() => setCopied(null), 1500);
  };

  if (!verified) {
    return (
      <Screen title={t('enroll.title')} back="/signin" bg="bg-grape-50">
        <form onSubmit={submitGate} className="flex flex-col gap-4 pt-4" noValidate>
          <p className="text-center font-medium text-ink/60">{t('enroll.adminOnly')}</p>
          <label className="flex flex-col gap-1 font-bold">
            {t('enroll.adminEmail')}
            <input className={input} type="email" autoComplete="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 font-bold">
            {t('enroll.adminPassword')}
            <input className={input} type="password" autoComplete="current-password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
          </label>
          {gateError && (
            <p role="alert" className="rounded-2xl bg-coral-100 p-3 font-bold text-coral-500">
              {gateError}
            </p>
          )}
          <Button type="submit" block>
            {t('enroll.verifyAdmin')}
          </Button>
        </form>
      </Screen>
    );
  }

  return (
    <Screen title={t('enroll.title')} back="/signin" bg="bg-grape-50">
      <div className="flex flex-col gap-4 pt-4">
        <label className="flex flex-col gap-1 font-bold">
          {t('enroll.memberEmail')}
          <input className={input} type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
        </label>
        <Button block disabled={!memberEmail.trim()} onClick={generate}>
          {t('enroll.generate')}
        </Button>

        {issued && (
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-bold">{t('enroll.shareTitle', { email: issued.email })}</p>
            <p className="text-sm text-ink/60">{t('enroll.shareBody')}</p>
            <div>
              <p className="mb-1 text-sm font-bold text-ink/60">{t('enroll.code')}</p>
              <div className="flex items-center gap-2">
                <span className="flex-1 rounded-2xl bg-grape-50 px-4 py-2 text-center text-2xl font-extrabold tracking-widest">{issued.code}</span>
                <Button variant="secondary" onClick={() => copy(issued.code, 'code')}>
                  {copied === 'code' ? t('enroll.copied') : t('enroll.copy')}
                </Button>
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm font-bold text-ink/60">{t('enroll.link')}</p>
              <div className="flex items-center gap-2">
                <input className="min-h-tap flex-1 rounded-2xl border-2 border-grape-200 bg-white px-3 text-sm" readOnly value={issued.link} />
                <Button variant="secondary" onClick={() => copy(issued.link, 'link')}>
                  {copied === 'link' ? t('enroll.copied') : t('enroll.copy')}
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setIssued(null);
                setMemberEmail('');
              }}
            >
              {t('enroll.another')}
            </Button>
          </div>
        )}
      </div>
    </Screen>
  );
}
