import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/lib/store';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

const input = 'min-h-tap w-full rounded-2xl border-2 border-grape-200 bg-white px-4 text-lg outline-none focus:border-grape-500';

/** The caregiver's half of enrollment: redeem the admin's code and choose a PIN to sign in with. */
export default function EnrollVerifyScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const verifyEnrollment = useStore((s) => s.verifyEnrollment);
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || !/^\d+$/.test(pin)) return setError(t('enrollVerify.pinHint'));
    if (pin !== pinConfirm) return setError(t('enrollVerify.mismatch'));
    setError(null);
    const ok = await verifyEnrollment(email, code, pin);
    if (!ok) return setError(t('enrollVerify.invalid'));
    setDone(true);
  };

  if (done) {
    return (
      <Screen title={t('enrollVerify.title')} bg="bg-grape-50">
        <div className="flex flex-col items-center gap-6 pt-10 text-center">
          <div className="text-7xl">🎉</div>
          <p className="text-xl font-bold">{t('enrollVerify.success')}</p>
          <Button block onClick={() => navigate('/signin/pin')}>
            {t('enrollVerify.signIn')}
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title={t('enrollVerify.title')} back="/signin" bg="bg-grape-50">
      <form onSubmit={submit} className="flex flex-col gap-4 pt-4" noValidate>
        <p className="text-ink/60">{t('enrollVerify.body')}</p>
        <label className="flex flex-col gap-1 font-bold">
          {t('enrollVerify.email')}
          <input className={input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {t('enrollVerify.code')}
          <input className={input} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {t('enrollVerify.pin')}
          <input className={input} type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} />
          <span className="text-sm font-medium text-ink/60">{t('enrollVerify.pinHint')}</span>
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {t('enrollVerify.pinConfirm')}
          <input className={input} type="password" inputMode="numeric" autoComplete="new-password" value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="rounded-2xl bg-coral-100 p-3 font-bold text-coral-500">
            {error}
          </p>
        )}
        <Button type="submit" block>
          {t('enrollVerify.submit')}
        </Button>
      </form>
    </Screen>
  );
}
