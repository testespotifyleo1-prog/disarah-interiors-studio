import { cn } from '@/lib/utils';

// Brand: Disarah Interiores. Component name kept as TyposLogo for legacy import compatibility.
interface TyposLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showCredit?: boolean;
  className?: string;
}

export function TyposLogo({ size = 'md', showCredit = false, className }: TyposLogoProps) {
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl xl:text-5xl',
  };

  const badgeSizes = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  };

  const creditSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
  };

  return (
    <span className={cn('inline-flex flex-col select-none', className)}>
      <span className="inline-flex items-baseline gap-1.5">
        <span
          className={cn(
            sizeClasses[size],
            'font-black tracking-tight bg-gradient-to-r from-[#C45E1A] via-[#D4722E] to-[#C45E1A] bg-clip-text text-transparent animate-logo-shimmer bg-[length:200%_100%]'
          )}
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Disarah
        </span>
        <span
          className={cn(
            badgeSizes[size],
            'rounded-md bg-[#C45E1A]/10 text-[#C45E1A] font-bold uppercase tracking-[0.18em] border border-[#C45E1A]/20 self-center'
          )}
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Interiores
        </span>
      </span>
      {showCredit && (
        <span
          className={cn(creditSizes[size], 'text-muted-foreground/60 font-medium tracking-wide')}
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Móveis & Decoração
        </span>
      )}
    </span>
  );
}
