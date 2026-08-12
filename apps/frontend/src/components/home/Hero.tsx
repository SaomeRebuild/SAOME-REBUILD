import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Play } from 'lucide-react';
import stampCardImage from '@/assets/images/stampCardLiviing-removebg-preview.png';

export function Hero() {
  const { t } = useTranslation('landing');

  return (
    <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: "url('/pic/bg/螢幕擷取畫面 2026-07-26 025811.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.2,
        }}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative z-10 text-center">
          {/* Badge */}
          <div
            className="mb-6 inline-flex items-center rounded-full border px-4 py-1.5"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {t('hero.badge')}
            </span>
          </div>

          {/* 標題與副標 */}
          <h1
            className="mt-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl"
            style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
          >
            {t('hero.title')}
          </h1>

          <p
            className="mt-6 text-lg"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {t('hero.subtitle')}
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {t('hero.subtitleDisclaimer')}
          </p>

          {/* 左右兩欄佈局 */}
          <div className="mt-6 grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            {/* 左邊：Stamp Card 圖片 */}
            <div className="order-2 lg:order-1">
              <img
                src={stampCardImage}
                alt={t('hero.passPreviewAlt')}
                className="h-auto w-1/2 mx-auto rounded-lg"
                style={{ boxShadow: 'var(--shadow-lifted)' }}
              />
            </div>

            {/* 右邊：文字內容 */}
            <div className="order-1 lg:order-2 text-left">
              {/* Wallet 支援標誌 */}
              <div className="mt-6 flex items-center justify-center lg:justify-start gap-6">
                <div className="flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                    Google Wallet
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                    Apple Wallet
                  </span>
                </div>
              </div>

              <p
                className="mt-4 text-lg"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {t('hero.passDescription')}
              </p>

              {/* 額外描述 */}
              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                  <p className="text-base" style={{ color: 'var(--color-foreground)' }}>
                    {t('hero.featureNoApp')}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                  <p className="text-base" style={{ color: 'var(--color-foreground)' }}>
                    {t('hero.featureRealtime')}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                  <p className="text-base" style={{ color: 'var(--color-foreground)' }}>
                    {t('hero.featureCoupon')}
                  </p>
                </div>
              </div>

              {/* 按鈕群 */}
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-md shadow-sm transition-all hover:opacity-90 hover:-translate-y-px active:translate-y-0 interactive-scale"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    padding: '0.875rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 500,
                  }}
                >
                  {t('hero.ctaPrimary')}
                  <ArrowRight size={18} />
                </Link>
                <Link
                  to="/demo"
                  className="inline-flex items-center justify-center gap-2 rounded-md border px-6 py-3 text-base font-medium shadow-sm transition-all hover:opacity-80"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-card)',
                    color: 'var(--color-muted-foreground)',
                  }}
                >
                  <Play size={18} />
                  {t('hero.ctaSecondary')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
