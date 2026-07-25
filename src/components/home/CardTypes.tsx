import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stamp, Coins, Gift, CreditCard, DollarSign, Ticket, Package, Percent } from 'lucide-react';

const cardTypes = [
  { key: 'stamp', Icon: Stamp },
  { key: 'point', Icon: Coins },
  { key: 'reward', Icon: Gift },
  { key: 'membership', Icon: CreditCard },
  { key: 'cashback', Icon: DollarSign },
  { key: 'coupon', Icon: Ticket },
  { key: 'giftCard', Icon: Package },
  { key: 'discount', Icon: Percent },
];

export function CardTypes() {
  const { t } = useTranslation();
  const [flippedId, setFlippedId] = useState<string | null>(null);

  return (
    <section
      id="card-types"
      className="py-20 lg:py-28"
      style={{
        backgroundImage: 'url(/pic/Device_-_Macbook_Air.png.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        position: 'relative',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: 'var(--color-background)', opacity: 0.75 }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2
            className="text-3xl font-bold sm:text-4xl"
            style={{
              fontFamily: 'var(--font-family-heading)',
              color: 'var(--color-foreground)',
            }}
          >
            {t('cardTypes.title')}
          </h2>
          <p
            className="mt-4 text-lg"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {t('cardTypes.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:gap-8">
          {cardTypes.map(({ key, Icon }) => {
            const isFlipped = flippedId === key;
            return (
              <div
                key={key}
                className="cursor-pointer"
                style={{ height: '280px', perspective: '1000px' }}
                onClick={() => setFlippedId(isFlipped ? null : key)}
                onMouseEnter={() => setFlippedId(key)}
                onMouseLeave={() => setFlippedId(null)}
                role="button"
                aria-label={t(`cardTypes.${key}.name`)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setFlippedId(isFlipped ? null : key);
                  }
                }}
              >
                <div
                  className="relative h-full w-full transition-transform duration-500"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* Front */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-6 backdrop-blur-sm"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'transparent',
                      backfaceVisibility: 'hidden',
                    }}
                  >
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      <Icon size={28} style={{ color: 'var(--color-on-primary)' }} />
                    </div>
                    <span
                      className="text-center text-base font-semibold"
                      style={{
                        fontFamily: 'var(--font-family-heading)',
                        color: 'var(--color-foreground)',
                      }}
                    >
                      {t(`cardTypes.${key}.name`)}
                    </span>
                    <span
                      className="text-center text-xs"
                      style={{ color: 'var(--color-muted-foreground)' }}
                    >
                      {t('cardTypes.subtitle')}
                    </span>
                  </div>

                  {/* Back */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 p-6 backdrop-blur-sm"
                    style={{
                      borderColor: 'var(--color-primary)',
                      backgroundColor: 'transparent',
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      <Icon size={20} style={{ color: 'var(--color-on-primary)' }} />
                    </div>
                    <span
                      className="text-center text-sm font-semibold"
                      style={{
                        fontFamily: 'var(--font-family-heading)',
                        color: 'var(--color-foreground)',
                      }}
                    >
                      {t(`cardTypes.${key}.name`)}
                    </span>
                    <p
                      className="text-center text-xs leading-relaxed"
                      style={{ color: 'var(--color-muted-foreground)' }}
                    >
                      {t(`cardTypes.${key}.desc`)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
