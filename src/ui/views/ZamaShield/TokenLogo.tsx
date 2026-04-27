import React, { useState } from 'react';
import clsx from 'clsx';

type Props = {
  src?: string;
  alt: string;
  size?: number;
  showShield?: boolean;
  className?: string;
};

// Tiny shield-lock badge stamped onto the bottom-right of a token logo to make
// it visually obvious that the asset is a confidential ERC-7984 wrapper.
const ShieldBadge: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 1.25 1.75 3v4.4c0 3.6 2.5 6.4 6.25 7.6 3.75-1.2 6.25-4 6.25-7.6V3L8 1.25Z"
      fill="#4C65FF"
      stroke="#fff"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <rect x="5.5" y="7.5" width="5" height="3.75" rx="0.6" fill="#fff" />
    <path
      d="M6.5 7.5V6.4c0-.8.67-1.4 1.5-1.4s1.5.6 1.5 1.4V7.5"
      stroke="#fff"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

export const TokenLogo: React.FC<Props> = ({
  src,
  alt,
  size = 32,
  showShield = true,
  className,
}) => {
  const [errored, setErrored] = useState(false);
  const showImg = !!src && !errored;
  const initial = alt?.replace(/^c/, '').slice(0, 1).toUpperCase() || '?';
  const badgeSize = Math.max(12, Math.round(size * 0.46));
  return (
    <div
      className={clsx('relative shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          onError={() => setErrored(true)}
          className="w-full h-full rounded-full object-cover bg-r-neutral-card2"
        />
      ) : (
        <div
          className="w-full h-full rounded-full bg-r-neutral-card2 text-r-neutral-title1 font-medium flex items-center justify-center"
          style={{ fontSize: Math.round(size * 0.42) }}
        >
          {initial}
        </div>
      )}
      {showShield && (
        <div
          className="absolute rounded-full bg-r-neutral-bg1 flex items-center justify-center"
          style={{
            width: badgeSize,
            height: badgeSize,
            right: -Math.round(badgeSize * 0.15),
            bottom: -Math.round(badgeSize * 0.15),
            padding: Math.max(1, Math.round(badgeSize * 0.08)),
          }}
        >
          <ShieldBadge size={badgeSize - 2} />
        </div>
      )}
    </div>
  );
};

export default TokenLogo;
