import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PassportService } from '@/lib/services/passport.service';
import { PublicPassportView } from '@/components/passport';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verified Skill Passport | Axis Colleges',
  description:
    'Official faculty-endorsed Skill & Achievement Passport verified by Axis Institute of Technology & Management.',
};

interface PublicPassportPageProps {
  params: Promise<{ shareToken: string }>;
}

export default async function PublicPassportPage({ params }: PublicPassportPageProps) {
  const { shareToken } = await params;

  try {
    const portfolio = await PassportService.getPublicPassportByToken(shareToken);
    return (
      <main className="bg-background text-foreground min-h-screen">
        <PublicPassportView portfolio={portfolio} />
      </main>
    );
  } catch {
    notFound();
  }
}
