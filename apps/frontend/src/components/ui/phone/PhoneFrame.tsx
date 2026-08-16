/**
 * PhoneFrame — 手機框架 SVG
 * 預設 iPhone 12/13 比例 (375:812)
 * 會根據容器寬度自適應縮放
 */
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface PhoneFrameProps extends HTMLAttributes<HTMLDivElement> {}

const PHONE_WIDTH = 375;
const PHONE_HEIGHT = 812;

export function PhoneFrame({ className, children, ...props }: PhoneFrameProps) {
  return (
    <div
      className={cn('relative w-full', className)}
      style={{ aspectRatio: `${PHONE_WIDTH} / ${PHONE_HEIGHT}` }}
      {...props}
    >
      {/* Phone Frame SVG — 絕對定位，填滿容器 */}
      <svg
        viewBox={`0 0 ${PHONE_WIDTH} ${PHONE_HEIGHT}`}
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Phone body (dark border) */}
        <rect
          x="0"
          y="0"
          width={PHONE_WIDTH}
          height={PHONE_HEIGHT}
          rx="40"
          fill="#1a1a1a"
        />

        {/* Screen (white) */}
        <rect
          x="8"
          y="8"
          width={PHONE_WIDTH - 16}
          height={PHONE_HEIGHT - 16}
          rx="32"
          fill="white"
        />

        {/* Notch */}
        <rect
          x="117"
          y="8"
          width="141"
          height="34"
          rx="16"
          fill="#1a1a1a"
        />

        {/* Notch speaker */}
        <rect
          x="154"
          y="17"
          width="67"
          height="6"
          rx="3"
          fill="#2a2a2a"
        />

        {/* Home indicator bar */}
        <rect
          x="134"
          y={PHONE_HEIGHT - 34}
          width="107"
          height="6"
          rx="3"
          fill="#d1d1d6"
        />
      </svg>

      {/* Content container (the actual screen area) */}
      <div
        className="absolute overflow-hidden rounded-[24px]"
        style={{
          top: 8,
          left: 8,
          right: 8,
          bottom: 8,
        }}
      >
        {/* 卡片內容，可滾動，避開聽筒與狀態列區 */}
        <div className="w-full h-full overflow-y-auto pt-10">
          {children}
        </div>
      </div>
    </div>
  );
}
