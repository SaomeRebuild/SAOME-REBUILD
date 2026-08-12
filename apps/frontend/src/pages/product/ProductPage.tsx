import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  ClipboardList,
  Search,
  BarChart3,
  Palette,
  Type,
  Link as LinkIcon,
  Phone,
  Map,
  Smartphone,
  Globe,
  LayoutTemplate,
  Sparkles,
  Megaphone,
  Radio,
  MessageSquare,
  Users,
  Inbox,
  CheckCircle,
  Printer,
  QrCode,
} from 'lucide-react';

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-12 text-center">
      <h2
        className="text-3xl font-bold sm:text-4xl"
        style={{
          fontFamily: 'var(--font-family-heading)',
          color: 'var(--color-foreground)',
        }}
      >
        {title}
      </h2>
      <p
        className="mt-4 text-lg"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-xl border p-6 transition-shadow hover:shadow-lg"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-card)',
      }}
    >
      <div
        className="mb-4 inline-flex items-center justify-center rounded-md p-2"
        style={{
          color: 'var(--color-primary)',
          backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
        }}
      >
        {icon}
      </div>
      <h3
        className="mb-2 text-xl font-semibold"
        style={{
          fontFamily: 'var(--font-family-heading)',
          color: 'var(--color-foreground)',
        }}
      >
        {title}
      </h3>
      <p
        className="text-sm leading-relaxed"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {description}
      </p>
    </div>
  );
}

export function ProductPage() {
  const { t } = useTranslation('landing');

  return (
    <div style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Hero Section */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1
              className="text-4xl font-bold sm:text-5xl lg:text-6xl"
              style={{
                fontFamily: 'var(--font-family-heading)',
                color: 'var(--color-foreground)',
              }}
            >
              {t('product.hero.title')}
            </h1>
            <p
              className="mt-6 text-xl"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {t('product.hero.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* 1. 產品介紹 */}
      <section
        className="py-16 lg:py-24"
        style={{ backgroundColor: 'var(--color-muted)' }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title={t('product.intro.title')}
            subtitle={t('product.intro.subtitle')}
          />
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<ClipboardList size={28} />}
              title={t('product.intro.form.title')}
              description={t('product.intro.form.desc')}
            />
            <FeatureCard
              icon={<Search size={28} />}
              title={t('product.intro.duplicate.title')}
              description={t('product.intro.duplicate.desc')}
            />
            <FeatureCard
              icon={<BarChart3 size={28} />}
              title={t('product.intro.crm.title')}
              description={t('product.intro.crm.desc')}
            />
          </div>
          <p className="mt-8 text-center text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {t('product.intro.compliance')}
          </p>
        </div>
      </section>

      {/* 2. 卡片客製化 */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title={t('product.custom.title')}
            subtitle={t('product.custom.subtitle')}
          />
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<Palette size={28} />}
              title={t('product.custom.design.title')}
              description={t('product.custom.design.desc')}
            />
            <FeatureCard
              icon={<Type size={28} />}
              title={t('product.custom.description.title')}
              description={t('product.custom.description.desc')}
            />
            <FeatureCard
              icon={<LinkIcon size={28} />}
              title={t('product.custom.links.title')}
              description={t('product.custom.links.desc')}
            />
          </div>
        </div>
      </section>

      {/* 3. 高效互動 */}
      <section className="py-16 lg:py-24" style={{ backgroundColor: 'var(--color-muted)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title={t('product.engage.title')}
            subtitle={t('product.engage.subtitle')}
          />
          <div className="grid gap-8 md:grid-cols-3 lg:grid-cols-6">
            <FeatureCard
              icon={<ClipboardList size={28} />}
              title={t('product.engage.survey.title')}
              description={t('product.engage.survey.desc')}
            />
            <FeatureCard
              icon={<Megaphone size={28} />}
              title={t('product.engage.referral.title')}
              description={t('product.engage.referral.desc')}
            />
            <FeatureCard
              icon={<Phone size={28} />}
              title={t('product.engage.call.title')}
              description={t('product.engage.call.desc')}
            />
            <FeatureCard
              icon={<Map size={28} />}
              title={t('product.engage.map.title')}
              description={t('product.engage.map.desc')}
            />
            <FeatureCard
              icon={<Smartphone size={28} />}
              title={t('product.engage.social.title')}
              description={t('product.engage.social.desc')}
            />
            <FeatureCard
              icon={<Globe size={28} />}
              title={t('product.engage.website.title')}
              description={t('product.engage.website.desc')}
            />
          </div>
        </div>
      </section>

      {/* 4. 卡片建置器 */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title={t('product.builder.title')}
            subtitle={t('product.builder.subtitle')}
          />
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<LayoutTemplate size={28} />}
              title={t('product.builder.templates.title')}
              description={t('product.builder.templates.desc')}
            />
            <FeatureCard
              icon={<Sparkles size={28} />}
              title={t('product.builder.custom.title')}
              description={t('product.builder.custom.desc')}
            />
            <FeatureCard
              icon={<Megaphone size={28} />}
              title={t('product.builder.marketing.title')}
              description={t('product.builder.marketing.desc')}
            />
          </div>
        </div>
      </section>

      {/* 5. 行銷方案 */}
      <section className="py-16 lg:py-24" style={{ backgroundColor: 'var(--color-muted)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title={t('product.campaign.title')}
            subtitle={t('product.campaign.subtitle')}
          />
          <div className="grid gap-8 md:grid-cols-2">
            <FeatureCard
              icon={<MessageSquare size={28} />}
              title={t('product.campaign.questionnaire.title')}
              description={t('product.campaign.questionnaire.desc')}
            />
            <FeatureCard
              icon={<Radio size={28} />}
              title={t('product.campaign.push.title')}
              description={t('product.campaign.push.desc')}
            />
          </div>
        </div>
      </section>

      {/* 6. 訊息分享 */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title={t('product.share.title')}
            subtitle={t('product.share.subtitle')}
          />
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<MessageSquare size={28} />}
              title={t('product.share.online.title')}
              description={t('product.share.online.desc')}
            />
            <FeatureCard
              icon={<Globe size={28} />}
              title={t('product.share.website.title')}
              description={t('product.share.website.desc')}
            />
            <FeatureCard
              icon={<Users size={28} />}
              title={t('product.share.referral.title')}
              description={t('product.share.referral.desc')}
            />
          </div>
        </div>
      </section>

      {/* 7. 電子信箱 */}
      <section className="py-16 lg:py-24" style={{ backgroundColor: 'var(--color-muted)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title={t('product.email.title')}
            subtitle={t('product.email.subtitle')}
          />
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<Inbox size={28} />}
              title={t('product.email.import.title')}
              description={t('product.email.import.desc')}
            />
            <FeatureCard
              icon={<Megaphone size={28} />}
              title={t('product.email.push.title')}
              description={t('product.email.push.desc')}
            />
            <FeatureCard
              icon={<CheckCircle size={28} />}
              title={t('product.email.status.title')}
              description={t('product.email.status.desc')}
            />
          </div>
        </div>
      </section>

      {/* 8. 離線模式 */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title={t('product.offline.title')}
            subtitle={t('product.offline.subtitle')}
          />
          <div className="grid gap-8 md:grid-cols-2">
            <FeatureCard
              icon={<Printer size={28} />}
              title={t('product.offline.print.title')}
              description={t('product.offline.print.desc')}
            />
            <FeatureCard
              icon={<QrCode size={28} />}
              title={t('product.offline.scanner.title')}
              description={t('product.offline.scanner.desc')}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-24" style={{ backgroundColor: 'var(--color-primary)' }}>
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2
            className="text-3xl font-bold sm:text-4xl"
            style={{
              fontFamily: 'var(--font-family-heading)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            {t('product.cta.title')}
          </h2>
          <p
            className="mt-4 text-lg"
            style={{ color: 'var(--color-primary-foreground)', opacity: 0.9 }}
          >
            {t('product.cta.subtitle')}
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              to="/register"
              className="rounded-full px-8 py-3 font-semibold transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'var(--color-card)',
                color: 'var(--color-primary)',
              }}
            >
              {t('product.cta.button')}
            </Link>
            <Link
              to="/pricing/compare"
              className="rounded-full border-2 border-white px-8 py-3 font-semibold transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-primary-foreground)' }}
            >
              {t('product.cta.pricing')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
