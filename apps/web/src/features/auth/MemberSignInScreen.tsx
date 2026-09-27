import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/lib/store';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

const input = 'min-h-tap w-full rounded-2xl border-2 border-grape-200 bg-white px-4 text-lg outline-none focus:border-grape-500';

/** Caregiver sign-in with email + PIN (set up via /enroll), instead of the admin's email + password. */
export default function MemberSignInScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const memberSignIn = useStore((s) => s.memberSignIn);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!(await memberSignIn(email, pin))) return setError(t('memberSignIn.wrong'));
    navigate('/profiles');
  };

  return (
    <Screen title={t('memberSignIn.title')} back="/signin" bg="bg-grape-50">
      <form onSubmit={submit} className="flex flex-col gap-4 pt-4" noValidate>
        <label className="flex flex-col gap-1 font-bold">
          {t('memberSignIn.email')}
          <input className={input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {t('memberSignIn.pin')}
          <input className={input} type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="rounded-2xl bg-coral-100 p-3 font-bold text-coral-500">
            {error}
          </p>
        )}
        <Button type="submit" block>
          {t('memberSignIn.submit')}
        </Button>
        <Button variant="ghost" block onClick={() => navigate('/signin')}>
          {t('memberSignIn.back')}
        </Button>
      </form>
    </Screen>
  );
}
