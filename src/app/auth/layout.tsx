import { recaptchaDisabled } from '@/lib/flags/flags';
import { getContentSections } from '@/lib/content/site-content';
import { SiteContentProvider } from '@/lib/content/SiteContentContext';
import { RecaptchaProvider } from './recaptcha-provider';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [disabled, content] = await Promise.all([
    recaptchaDisabled(),
    getContentSections(['auth.shared', 'auth.login', 'auth.signup']),
  ]);

  return (
    <SiteContentProvider content={content}>
      <RecaptchaProvider enabled={!disabled}>{children}</RecaptchaProvider>
    </SiteContentProvider>
  );
}
