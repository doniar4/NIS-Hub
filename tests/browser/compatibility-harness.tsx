import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { AppFrame } from '../../src/components/app-frame';
import { LocaleProvider, useI18n } from '../../src/components/locale-provider';
import { SmoothScroll } from '../../src/components/smooth-scroll';
import { ProfileForm } from '../../src/components/profile-form';
import { AvatarForm } from '../../src/components/avatar-form';
import { ActionForm } from '../../src/components/action-form';
import { Field } from '../../src/components/fields';
import { WelcomeAuth } from '../../src/components/welcome-auth';
import type { ActionState } from '../../src/lib/action-state';
const fixture = (window as unknown as { fixture: { bio: string; hasAvatar: boolean } }).fixture;
async function upload(_: ActionState, form: FormData) {
  return (await fetch('/fixture/avatar', { method: 'POST', body: form.get('avatar') as File })).json();
}
function AuthFields({ mode }: { mode: 'signup' | 'login' }) {
  const { t } = useI18n();
  return <ActionForm action={async (_, form) => (await fetch('/fixture/auth', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) })).json()} label={t[mode]} submitVariant="flame">
    <input type="hidden" name="mode" value={mode} />
    <Field name="email" type="email" label={t.email} required />
    <Field name="password" type="password" label={t.password} required minLength={8} />
    {mode === 'signup' && <label><input type="checkbox" name="terms" required />{t.accept}</label>}
  </ActionForm>;
}
function Harness() {
  const [locale, setLocale] = useState<'ru' | 'kk' | 'en'>('ru');
  return <LocaleProvider locale={locale}>
    <SmoothScroll />
    <AppFrame preferences={<><button onClick={() => setLocale('ru')}>RU</button><button onClick={() => setLocale('kk')}>KZ</button><button onClick={() => setLocale('en')}>EN</button></>} account={<button>Ученик</button>} avatar={null}>
      <ProfileForm classes={[]} subjects={[]} top={[]} hasAvatar={fixture.hasAvatar} profile={{ display_name: 'Ученик', class_id: null, bio: fixture.bio }} />
      <AvatarForm url={null} hasAvatar={fixture.hasAvatar} hidePreview action={upload} />
      <WelcomeAuth configured signupForm={<AuthFields mode="signup" />} loginForm={<AuthFields mode="login" />} />
      <div style={{height: '60vh'}} />
    </AppFrame>
  </LocaleProvider>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
