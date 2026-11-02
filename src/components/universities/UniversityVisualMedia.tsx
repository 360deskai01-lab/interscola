'use client';

import { useState, type ReactNode } from 'react';

export interface UniversityVisualFields {
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
}

export function universityInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

const COVER_GRADIENT =
  'bg-gradient-to-br from-indigo-600/50 via-slate-900 to-violet-900/45';

export function UniversityCoverImage({
  coverUrl,
  alt,
  className = '',
  heightClass = 'h-[132px]',
}: {
  coverUrl: string | null;
  alt: string;
  className?: string;
  heightClass?: string;
}): ReactNode {
  const [failed, setFailed] = useState(false);
  const src = coverUrl?.trim();

  if (!src || failed) {
    return (
      <div
        className={`${heightClass} w-full ${COVER_GRADIENT} ${className}`}
        aria-hidden={!alt}
      />
    );
  }

  return (
    <div className={`relative ${heightClass} w-full overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/** Şeffaf PNG/SVG logolar koyu kapak üzerinde okunaklı kalsın diye sabit beyaz zemin. */
const CARD_LOGO_BOX_CLASS =
  'flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-2 shadow-2xl ring-2 ring-white/30 sm:size-20';

const DEFAULT_LOGO_BOX_CLASS =
  'grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-2 shadow-lg ring-2 ring-white/25';

export function UniversityLogoMark({
  logoUrl,
  name,
  sizeClass = 'size-10',
  textClass = 'text-xs',
  variant = 'default',
}: {
  logoUrl: string | null;
  name: string;
  sizeClass?: string;
  textClass?: string;
  /** Kart kapaklarında ortalanmış büyük logo */
  variant?: 'default' | 'cardCenter';
}): ReactNode {
  const [failed, setFailed] = useState(false);
  const src = logoUrl?.trim();

  if (variant === 'cardCenter') {
    if (src && !failed) {
      return (
        <span className={CARD_LOGO_BOX_CLASS}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="size-full object-contain"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        </span>
      );
    }

    return (
      <span
        className={`${CARD_LOGO_BOX_CLASS} text-xl font-bold text-slate-800`}
        aria-hidden
      >
        {universityInitials(name)}
      </span>
    );
  }

  if (src && !failed) {
    return (
      <span className={`${DEFAULT_LOGO_BOX_CLASS} ${sizeClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="size-full object-contain"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`${sizeClass} grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 ring-2 ring-white/25 ${textClass} font-bold text-white shadow-lg`}
      aria-hidden
    >
      {universityInitials(name)}
    </span>
  );
}

/** Kapak + ortada logo (liste / vitrin / pin kartları). */
export function UniversityCardMediaHeader({
  university,
  coverHeightClass = 'h-[132px]',
  roundedTopClass = 'rounded-t-xl',
}: {
  university: UniversityVisualFields;
  coverHeightClass?: string;
  roundedTopClass?: string;
}): ReactNode {
  return (
    <div className={`relative shrink-0 ${roundedTopClass} overflow-hidden`}>
      <UniversityCoverImage
        coverUrl={university.cover_image_url}
        alt={`${university.name} kampüs görseli`}
        heightClass={coverHeightClass}
        className={roundedTopClass}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-slate-950/30"
        aria-hidden
      />
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <UniversityLogoMark
          logoUrl={university.logo_url}
          name={university.name}
          variant="cardCenter"
        />
      </div>
    </div>
  );
}

/** Detay sayfası / modal üst banner. */
export function UniversityHeroBanner({
  university,
  coverHeightClass = 'h-44 sm:h-52',
}: {
  university: UniversityVisualFields;
  coverHeightClass?: string;
}): ReactNode {
  return (
    <div className="relative overflow-hidden rounded-t-2xl sm:rounded-t-3xl">
      <UniversityCoverImage
        coverUrl={university.cover_image_url}
        alt={`${university.name} kapak görseli`}
        heightClass={coverHeightClass}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
      <div className="absolute bottom-4 left-5 flex items-end gap-3">
        <UniversityLogoMark
          logoUrl={university.logo_url}
          name={university.name}
          sizeClass="size-12"
          textClass="text-sm"
        />
      </div>
    </div>
  );
}
