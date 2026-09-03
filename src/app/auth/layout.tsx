import { recaptchaDisabled } from '@/lib/flags/flags';
import { RecaptchaProvider } from './recaptcha-provider';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const disabled = await recaptchaDisabled();

  return <RecaptchaProvider enabled={!disabled}>{children}</RecaptchaProvider>;
}
