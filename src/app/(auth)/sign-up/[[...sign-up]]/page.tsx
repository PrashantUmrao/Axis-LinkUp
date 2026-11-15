import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Public Registration Closed | Axis LinkUp',
  description: 'Self-service account registration is permanently closed. Redirecting to Portal Sign In.',
};

export default function SignUpPage() {
  redirect('/sign-in');
}
