import React from 'react';

interface FlagIconProps {
  codigo?: string;
  iso?: string;
  className?: string;
}

export function FlagIcon({ codigo, iso, className = 'w-5 h-3.5' }: FlagIconProps) {
  const normIso = (iso || '').toLowerCase().trim();
  const normCodigo = (codigo || '').trim();

  // Mapeo por código o ISO
  const getCountryKey = (): string => {
    if (normIso) return normIso;
    switch (normCodigo) {
      case '+58': return 've';
      case '+33': return 'fr';
      case '+1': return 'us';
      case '+34': return 'es';
      case '+57': return 'co';
      case '+56': return 'cl';
      case '+54': return 'ar';
      case '+507': return 'pa';
      case '+52': return 'mx';
      case '+51': return 'pe';
      case '+55': return 'br';
      default: return 've';
    }
  };

  const key = getCountryKey();

  const renderFlagSvg = () => {
    switch (key) {
      case 've': // Venezuela
        return (
          <svg viewBox="0 0 32 24" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="8" fill="#FCE300" />
            <rect y="8" width="32" height="8" fill="#00247D" />
            <rect y="16" width="32" height="8" fill="#CF142B" />
            <g fill="#FFFFFF">
              <circle cx="10" cy="13.2" r="0.75" />
              <circle cx="11.6" cy="11.8" r="0.75" />
              <circle cx="13.5" cy="10.8" r="0.75" />
              <circle cx="15.2" cy="10.4" r="0.75" />
              <circle cx="16.8" cy="10.4" r="0.75" />
              <circle cx="18.5" cy="10.8" r="0.75" />
              <circle cx="20.4" cy="11.8" r="0.75" />
              <circle cx="22" cy="13.2" r="0.75" />
            </g>
          </svg>
        );

      case 'fr': // Francia
        return (
          <svg viewBox="0 0 32 24" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
            <rect width="10.67" height="24" fill="#002654" />
            <rect x="10.67" width="10.67" height="24" fill="#FFFFFF" />
            <rect x="21.33" width="10.67" height="24" fill="#ED2939" />
          </svg>
        );

      case 'us': // EE.UU. / Canadá
        return (
          <svg viewBox="0 0 32 24" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="24" fill="#B22234" />
            <path d="M0,1.85 H32 M0,5.54 H32 M0,9.23 H32 M0,12.92 H32 M0,16.62 H32 M0,20.31 H32" stroke="#FFFFFF" strokeWidth="1.85" />
            <rect width="14" height="13" fill="#3C3B6E" />
            <g fill="#FFFFFF">
              <circle cx="2.5" cy="2.5" r="0.65" /><circle cx="5.5" cy="2.5" r="0.65" /><circle cx="8.5" cy="2.5" r="0.65" /><circle cx="11.5" cy="2.5" r="0.65" />
              <circle cx="4" cy="4.5" r="0.65" /><circle cx="7" cy="4.5" r="0.65" /><circle cx="10" cy="4.5" r="0.65" />
              <circle cx="2.5" cy="6.5" r="0.65" /><circle cx="5.5" cy="6.5" r="0.65" /><circle cx="8.5" cy="6.5" r="0.65" /><circle cx="11.5" cy="6.5" r="0.65" />
              <circle cx="4" cy="8.5" r="0.65" /><circle cx="7" cy="8.5" r="0.65" /><circle cx="10" cy="8.5" r="0.65" />
              <circle cx="2.5" cy="10.5" r="0.65" /><circle cx="5.5" cy="10.5" r="0.65" /><circle cx="8.5" cy="10.5" r="0.65" /><circle cx="11.5" cy="10.5" r="0.65" />
            </g>
          </svg>
        );

      case 'es': // España
        return (
          <svg viewBox="0 0 32 24" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="6" fill="#AA151B" />
            <rect y="6" width="32" height="12" fill="#F1BF00" />
            <rect y="18" width="32" height="6" fill="#AA151B" />
            <rect x="7" y="9" width="3.5" height="5.5" rx="0.8" fill="#AA151B" />
            <circle cx="8.75" cy="11.75" r="1" fill="#F1BF00" />
          </svg>
        );

      case 'co': // Colombia
        return (
          <svg viewBox="0 0 32 24" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="12" fill="#FCD116" />
            <rect y="12" width="32" height="6" fill="#003893" />
            <rect y="18" width="32" height="6" fill="#CE1126" />
          </svg>
        );

      case 'cl': // Chile
        return (
          <svg viewBox="0 0 32 24" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="12" fill="#FFFFFF" />
            <rect y="12" width="32" height="12" fill="#D52B1E" />
            <rect width="12" height="12" fill="#0039A6" />
            <polygon points="6,2.5 7,5.5 10,5.5 7.5,7.5 8.5,10.5 6,8.5 3.5,10.5 4.5,7.5 2,5.5 5,5.5" fill="#FFFFFF" />
          </svg>
        );

      case 'ar': // Argentina
        return (
          <svg viewBox="0 0 32 24" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="8" fill="#75AADB" />
            <rect y="8" width="32" height="8" fill="#FFFFFF" />
            <rect y="16" width="32" height="8" fill="#75AADB" />
            <circle cx="16" cy="12" r="2.2" fill="#F6B40E" />
            <circle cx="16" cy="12" r="1.3" fill="#85340A" />
          </svg>
        );

      case 'pa': // Panamá
        return (
          <svg viewBox="0 0 32 24" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
            <rect width="16" height="12" fill="#FFFFFF" />
            <rect x="16" width="16" height="12" fill="#D21034" />
            <rect y="12" width="16" height="12" fill="#005293" />
            <rect x="16" y="12" width="16" height="12" fill="#FFFFFF" />
            <polygon points="8,3.5 8.8,5.8 11.2,5.8 9.3,7.2 10,9.5 8,8.1 6,9.5 6.7,7.2 4.8,5.8 7.2,5.8" fill="#005293" />
            <polygon points="24,15.5 24.8,17.8 27.2,17.8 25.3,19.2 26,21.5 24,20.1 22,21.5 22.7,19.2 20.8,17.8 23.2,17.8" fill="#D21034" />
          </svg>
        );

      case 'mx': // México
        return (
          <svg viewBox="0 0 32 24" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
            <rect width="10.67" height="24" fill="#006847" />
            <rect x="10.67" width="10.67" height="24" fill="#FFFFFF" />
            <rect x="21.33" width="10.67" height="24" fill="#CE1126" />
            <circle cx="16" cy="12" r="2" fill="#8B5A2B" />
          </svg>
        );

      case 'pe': // Perú
        return (
          <svg viewBox="0 0 32 24" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
            <rect width="10.67" height="24" fill="#D91023" />
            <rect x="10.67" width="10.67" height="24" fill="#FFFFFF" />
            <rect x="21.33" width="10.67" height="24" fill="#D91023" />
          </svg>
        );

      case 'br': // Brasil
        return (
          <svg viewBox="0 0 32 24" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="24" fill="#009C3B" />
            <polygon points="16,3 29,12 16,21 3,12" fill="#FFDF00" />
            <circle cx="16" cy="12" r="4.5" fill="#002776" />
            <path d="M12,13.2 Q16,10.5 20,11.5" stroke="#FFFFFF" strokeWidth="0.8" fill="none" />
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 32 24" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="8" fill="#FCE300" />
            <rect y="8" width="32" height="8" fill="#00247D" />
            <rect y="16" width="32" height="8" fill="#CF142B" />
          </svg>
        );
    }
  };

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden rounded-[3px] border border-black/15 shadow-[0_1px_2px_rgba(0,0,0,0.08)] align-middle leading-none ${className}`}
      title={normCodigo || normIso}
    >
      {renderFlagSvg()}
    </span>
  );
}
