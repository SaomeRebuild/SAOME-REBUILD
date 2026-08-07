/**
 * HomePage — public marketing landing.
 *
 * Visible to ALL visitors, authenticated or not. Authenticated users stay on
 * the marketing page even when they navigate to "/" — the dashboard is one
 * click away via the user-email link in the Header.
 *
 * 2026-08-08 UX change: the previous "reverse-direction AuthGuard" that
 * redirected authenticated users from / to their dashboard is removed. It
 * felt like the app was fighting the user whenever they tried to read the
 * marketing pages while logged in. The Header now owns the "back to
 * dashboard" affordance instead.
 *
 * The redirect wait (`!state.loading`) is still honoured so we don't briefly
 * flash the marketing page to a logged-in user who has just refreshed —
 * actually, even that wait is no longer necessary because HomePage never
 * navigates away. We keep `isAuthenticated` only to satisfy existing type
 * signatures if they reach for it later.
 */

import { Hero } from '@/components/home/Hero';
import { SocialProof } from '@/components/home/SocialProof';
import { Features } from '@/components/home/Features';
import { CardTypes } from '@/components/home/CardTypes';
import { HowItWorks } from '@/components/home/HowItWorks';
import { PricingSection } from '@/components/pricing/PricingSection';
import { CTASection } from '@/components/home/CTASection';
import { useAuth } from '@/hooks';

export function HomePage() {
  // Touch useAuth so the AuthProvider's session-recovery effect has a reason
  // to run on mount even if we don't redirect. We deliberately do NOT use
  // `state.user` here — staying on the marketing page is the same code path
  // for everyone.
  useAuth();

  return (
    <>
      <Hero />
      <SocialProof />
      <Features />
      <CardTypes />
      <HowItWorks />
      <PricingSection />
      <CTASection />
    </>
  );
}

export default HomePage;