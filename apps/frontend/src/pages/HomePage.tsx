/**
 * HomePage — public marketing landing.
 *
 * Composes the Hero, SocialProof, Features, CardTypes, HowItWorks, PricingSection
 * and CTASection sections. Anonymous visitors see this; authenticated users are
 * already redirected by AuthProvider / AuthGuard before they reach `/`.
 */

import { Hero } from '@/components/home/Hero';
import { SocialProof } from '@/components/home/SocialProof';
import { Features } from '@/components/home/Features';
import { CardTypes } from '@/components/home/CardTypes';
import { HowItWorks } from '@/components/home/HowItWorks';
import { PricingSection } from '@/components/pricing/PricingSection';
import { CTASection } from '@/components/home/CTASection';

export function HomePage() {
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