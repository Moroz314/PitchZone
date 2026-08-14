'use client';

interface KitPreviewProps {
  templateId: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string | null;
  className?: string;
}

const ACCENT_FALLBACK = '#FFFFFF';

function KitBody({
  templateId,
  primary,
  secondary,
  accent,
}: {
  templateId: string;
  primary: string;
  secondary: string;
  accent: string;
}) {
  switch (templateId) {
    case 'vertical-stripes':
      return (
        <>
          <rect x="36" y="28" width="12" height="72" fill={secondary} />
          <rect x="60" y="28" width="12" height="72" fill={secondary} />
          <rect x="84" y="28" width="12" height="72" fill={secondary} />
          <path d="M48 28 L72 12 L96 28 L96 100 L48 100 Z" fill={primary} opacity="0.35" />
          <path d="M24 36 L48 28 L96 28 L120 36 L120 52 L24 52 Z" fill={primary} />
          <path d="M24 52 L120 52 L120 100 L24 100 Z" fill={primary} />
        </>
      );
    case 'chest-stripe':
      return (
        <>
          <path d="M24 36 L48 28 L96 28 L120 36 L120 52 L24 52 Z" fill={primary} />
          <path d="M24 52 L120 52 L120 100 L24 100 Z" fill={primary} />
          <rect x="24" y="44" width="96" height="14" fill={secondary} />
          <path d="M48 28 L72 12 L96 28 L96 44 L48 44 Z" fill={secondary} />
        </>
      );
    case 'diagonal':
      return (
        <>
          <path d="M24 36 L48 28 L96 28 L120 36 L120 52 L24 52 Z" fill={primary} />
          <path d="M24 52 L120 52 L120 100 L24 100 Z" fill={primary} />
          <polygon points="24,52 120,28 120,72 24,100" fill={secondary} opacity="0.9" />
        </>
      );
    case 'contrast-sleeves':
      return (
        <>
          <path d="M24 36 L48 28 L96 28 L120 36 L120 52 L24 52 Z" fill={secondary} />
          <path d="M24 52 L120 52 L120 100 L24 100 Z" fill={secondary} />
          <path d="M48 28 L72 12 L96 28 L96 100 L48 100 Z" fill={primary} />
          <rect x="24" y="36" width="24" height="64" fill={secondary} />
          <rect x="96" y="36" width="24" height="64" fill={secondary} />
        </>
      );
    case 'center-stripe':
      return (
        <>
          <path d="M24 36 L48 28 L96 28 L120 36 L120 52 L24 52 Z" fill={primary} />
          <path d="M24 52 L120 52 L120 100 L24 100 Z" fill={primary} />
          <rect x="66" y="28" width="12" height="72" fill={secondary} />
        </>
      );
    case 'halves':
      return (
        <>
          <path d="M24 36 L48 28 L96 28 L120 36 L120 52 L24 52 Z" fill={primary} />
          <path d="M24 52 L72 52 L72 100 L24 100 Z" fill={primary} />
          <path d="M72 52 L120 52 L120 100 L72 100 Z" fill={secondary} />
          <path d="M72 28 L96 28 L96 52 L72 52 Z" fill={secondary} />
        </>
      );
    case 'geometric':
      return (
        <>
          <path d="M24 36 L48 28 L96 28 L120 36 L120 52 L24 52 Z" fill={primary} />
          <path d="M24 52 L120 52 L120 100 L24 100 Z" fill={primary} />
          <polygon points="48,52 72,40 96,52 96,76 72,88 48,76" fill={secondary} />
          <polygon points="60,58 72,52 84,58 84,70 72,76 60,70" fill={accent} />
        </>
      );
    default:
      return (
        <>
          <path d="M24 36 L48 28 L96 28 L120 36 L120 52 L24 52 Z" fill={primary} />
          <path d="M24 52 L120 52 L120 100 L24 100 Z" fill={primary} />
          <path d="M48 28 L72 12 L96 28 L96 44 L48 44 Z" fill={secondary} />
        </>
      );
  }
}

export function KitPreview({
  templateId,
  primaryColor,
  secondaryColor,
  accentColor,
  className = '',
}: KitPreviewProps) {
  const accent = accentColor || ACCENT_FALLBACK;

  return (
    <svg viewBox="0 0 144 112" className={className} role="img" aria-label="Превью формы клуба">
      <rect width="144" height="112" rx="8" fill="#0B0D12" />
      <KitBody
        templateId={templateId}
        primary={primaryColor}
        secondary={secondaryColor}
        accent={accent}
      />
      <path
        d="M48 28 L72 12 L96 28"
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <text x="72" y="78" textAnchor="middle" fill={accent} fontSize="16" fontWeight="700">
        10
      </text>
    </svg>
  );
}
