import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

type Tier = 'green' | 'gold' | 'platinum';

interface Feature {
  name: string;
  green?: boolean | string;
  gold?: boolean | string;
  platinum?: boolean | string;
}

const FEATURES: Feature[] = [
  // 卡片功能
  { name: 'card.templates', green: '3', gold: '6', platinum: '10' },
  { name: 'card.addresses', green: '1', gold: '3', platinum: '10' },
  { name: 'card.customDesign', green: true, gold: true, platinum: true },
  { name: 'card.links', green: true, gold: true, platinum: true },
  // CRM 功能
  { name: 'crm.duplicateCheck', green: true, gold: true, platinum: true },
  { name: 'crm.memberManagement', green: true, gold: true, platinum: true },
  { name: 'crm.subAccounts', green: false, gold: '1', platinum: '5' },
  // 行銷功能
  { name: 'marketing.emailMonthly', green: '50', gold: '80', platinum: '100' },
  { name: 'marketing.emailOverage', green: '$0.5/封', gold: '$0.4/封', platinum: '$0.3/封' },
  { name: 'marketing.survey', green: true, gold: true, platinum: true },
  { name: 'marketing.pushNotification', green: false, gold: true, platinum: true },
  { name: 'marketing.campaign', green: false, gold: true, platinum: true },
  // 分享功能
  { name: 'share.line', green: true, gold: true, platinum: true },
  { name: 'share.website', green: true, gold: true, platinum: true },
  { name: 'share.referral', green: false, gold: true, platinum: true },
  // 離線功能
  { name: 'offline.print', green: true, gold: true, platinum: true },
  { name: 'offline.scanner', green: false, gold: true, platinum: true },
  { name: 'offline.qrCode', green: true, gold: true, platinum: true },
  // 支援
  { name: 'support.email', green: true, gold: true, platinum: true },
  { name: 'support.priority', green: false, gold: false, platinum: true },
  { name: 'support.sla', green: false, gold: false, platinum: true },
];

const CATEGORIES = [
  { key: 'card', label: '卡片功能' },
  { key: 'crm', label: 'CRM 與會員管理' },
  { key: 'marketing', label: '行銷工具' },
  { key: 'share', label: '分享功能' },
  { key: 'offline', label: '線下模式' },
  { key: 'support', label: '支援服務' },
];

const PLANS = {
  green: { monthly: 900, yearly: 850 },
  gold: { monthly: 1500, yearly: 1400 },
  platinum: { monthly: 2500, yearly: 2050 },
};

function CheckIcon() {
  return (
    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function FeatureCell({ value }: { value: boolean | string | undefined }) {
  if (value === true) return <CheckIcon />;
  if (value === false) return <CrossIcon />;
  return <span className="text-sm">{value}</span>;
}

export function DetailedPricingPage() {
  const { t } = useTranslation();
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="py-16 lg:py-24" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1
            className="text-4xl font-bold sm:text-5xl"
            style={{
              fontFamily: 'var(--font-family-heading)',
              color: 'var(--color-foreground)',
            }}
          >
            {t('pricingCompare.title')}
          </h1>
          <p
            className="mt-4 text-lg"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {t('pricingCompare.subtitle')}
          </p>

          {/* Toggle */}
          <div className="mt-8 flex justify-center">
            <div
              className="relative inline-flex rounded-full p-1"
              style={{ backgroundColor: 'var(--color-muted)' }}
            >
              <button
                onClick={() => setIsYearly(false)}
                className="relative z-10 rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                style={{
                  color: !isYearly ? 'var(--color-primary-foreground)' : 'var(--color-foreground)',
                  backgroundColor: !isYearly ? 'var(--color-primary)' : 'transparent',
                }}
              >
                {t('pricing.monthly')}
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className="relative z-10 rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                style={{
                  color: isYearly ? 'var(--color-primary-foreground)' : 'var(--color-foreground)',
                  backgroundColor: isYearly ? 'var(--color-primary)' : 'transparent',
                }}
              >
                {t('pricing.yearly')}
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-1/4 p-4 text-left">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                    {t('pricingCompare.feature')}
                  </span>
                </th>
                {(['green', 'gold', 'platinum'] as Tier[]).map((tier) => (
                  <th key={tier} className="w-1/4 p-4 text-center">
                    <div
                      className={`rounded-xl border p-4 ${
                        tier === 'gold' ? 'ring-2' : ''
                      }`}
                      style={{
                        borderColor: tier === 'gold' ? 'var(--color-primary)' : 'var(--color-border)',
                        backgroundColor: 'var(--color-card)',
                      }}
                    >
                      {tier === 'gold' && (
                        <span
                          className="mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: 'var(--color-primary)',
                            color: 'var(--color-primary-foreground)',
                          }}
                        >
                          {t('pricing.popular')}
                        </span>
                      )}
                      <h3
                        className="text-xl font-bold"
                        style={{
                          fontFamily: 'var(--font-family-heading)',
                          color: 'var(--color-foreground)',
                        }}
                      >
                        {t(`pricing.${tier}.name`)}
                      </h3>
                      <p className="mt-1 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                        {t(`pricing.${tier}.description`)}
                      </p>
                      <p className="mt-3 text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
                        ${isYearly ? PLANS[tier].yearly : PLANS[tier].monthly}
                        <span className="text-sm font-normal" style={{ color: 'var(--color-muted-foreground)' }}>
                          /{t('pricing.perMonth').replace('/', '')}
                        </span>
                      </p>
                      {isYearly && (
                        <p className="mt-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                          {t('pricingCompare.billedYearly')}
                        </p>
                      )}
                      <Link
                        to="/register"
                        className="mt-4 block rounded-full py-2 text-center text-sm font-medium transition-opacity hover:opacity-90"
                        style={{
                          backgroundColor: tier === 'gold' ? 'var(--color-primary)' : 'var(--color-muted)',
                          color: tier === 'gold' ? 'var(--color-primary-foreground)' : 'var(--color-foreground)',
                        }}
                      >
                        {t('pricing.cta')}
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category) => (
                <>
                  <tr key={`header-${category.key}`}>
                    <td
                      colSpan={4}
                      className="px-4 py-3 font-semibold"
                      style={{
                        color: 'var(--color-foreground)',
                        backgroundColor: 'var(--color-muted)',
                      }}
                    >
                      {category.label}
                    </td>
                  </tr>
                  {FEATURES.filter((f) => f.name.startsWith(category.key)).map((feature, idx) => (
                    <tr
                      key={feature.name}
                      className="border-b"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <td className="p-4 text-sm" style={{ color: 'var(--color-foreground)' }}>
                        {t(`pricingCompare.${feature.name}`)}
                      </td>
                      {(['green', 'gold', 'platinum'] as Tier[]).map((tier) => (
                        <td
                          key={tier}
                          className="p-4 text-center"
                          style={{ backgroundColor: 'var(--color-card)' }}
                        >
                          <div className="flex justify-center">
                            <FeatureCell value={feature[tier]} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {t('pricingCompare.footer')}
          </p>
          <Link
            to="/register"
            className="inline-block rounded-full px-8 py-3 font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            {t('pricingCompare.startTrial')}
          </Link>
        </div>
      </div>
    </div>
  );
}
