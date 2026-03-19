import type { ReactNode } from 'react';
import ApplicantShell from './_components/ApplicantShell';

export default function ApplicantLayout({ children }: { children: ReactNode }) {
  return <ApplicantShell>{children}</ApplicantShell>;
}
