import { cn } from '@/lib/utils';

interface ConectaMixLogoProps {
  size?: 'sm' | 'md' | 'hero';
  className?: string;
}

const sizeStyles = {
  sm: {
    shell: 'max-w-[220px] px-3 py-2 rounded-[18px]',
    rail: 'w-1.5',
    dot: 'h-1.5 w-1.5',
    title: 'text-[22px]',
    badge: 'text-[7px]',
    meta: 'text-[7px]',
  },
  md: {
    shell: 'max-w-[300px] px-4 py-2.5 rounded-[22px]',
    rail: 'w-2',
    dot: 'h-2 w-2',
    title: 'text-[30px] sm:text-[32px]',
    badge: 'text-[8px] sm:text-[9px]',
    meta: 'text-[8px] sm:text-[9px]',
  },
  hero: {
    shell:
      'w-full max-w-[140px] sm:max-w-[170px] lg:max-w-[200px] xl:max-w-[230px] px-2.5 sm:px-3 lg:px-3.5 py-1.5 sm:py-2 lg:py-2 rounded-[14px] sm:rounded-[16px] lg:rounded-[18px]',
    rail: 'w-1 sm:w-1.5',
    dot: 'h-1 w-1 lg:h-1.5 lg:w-1.5',
    title: 'text-[16px] sm:text-[19px] lg:text-[23px] xl:text-[26px]',
    badge: 'text-[5px] sm:text-[6px] lg:text-[7px] xl:text-[7.5px]',
    meta: 'text-[5px] sm:text-[6px] lg:text-[7px] xl:text-[7px]',
  },
} as const;

export function ConectaMixLogo({ size = 'md', className }: ConectaMixLogoProps) {
  const styles = sizeStyles[size];

  return (
    <div
      className={cn('relative isolate inline-flex min-w-0 overflow-hidden border shadow-xl', styles.shell, className)}
      style={{
        fontFamily: "'Outfit', sans-serif",
        borderColor: 'hsl(var(--conecta-border) / 0.55)',
        backgroundImage:
          'linear-gradient(135deg, hsl(var(--conecta-surface)) 0%, hsl(var(--conecta-surface-strong)) 100%)',
      }}
    >
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at top left, hsl(var(--conecta-gold) / 0.24), transparent 34%), radial-gradient(circle at bottom right, hsl(var(--conecta-accent) / 0.12), transparent 42%)',
        }}
      />
      <span
        className="conecta-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-20 sm:w-24 blur-xl"
        style={{
          backgroundImage:
            'linear-gradient(90deg, transparent, hsl(var(--background) / 0.88), transparent)',
        }}
      />

      <div className="relative flex w-full items-center gap-3">
        <span
          className={cn('block self-stretch rounded-full', styles.rail)}
          style={{
            backgroundImage:
              'linear-gradient(180deg, hsl(var(--conecta-accent)) 0%, hsl(var(--conecta-gold)) 100%)',
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-end gap-1.5 sm:gap-2 leading-none whitespace-nowrap">
            <span
              className={cn('font-black uppercase tracking-[-0.09em]', styles.title)}
              style={{ color: 'hsl(var(--conecta-ink))' }}
            >
              Conecta
            </span>
            <span
              className={cn('font-black uppercase tracking-[-0.07em]', styles.title)}
              style={{ color: 'hsl(var(--conecta-accent))' }}
            >
              Mix
            </span>
          </div>

          <div className="mt-1 flex items-start gap-2">
            <span
              className={cn('conecta-orbit mt-1 shrink-0 rounded-full', styles.dot)}
              style={{ backgroundColor: 'hsl(var(--conecta-gold))' }}
            />
            <span
              className={cn(
                'max-w-full rounded-full px-2.5 py-1 text-center font-semibold uppercase leading-[1.05] shadow-md sm:px-3',
                styles.badge
              )}
              style={{
                backgroundColor: 'hsl(var(--conecta-ink))',
                color: 'hsl(var(--primary-foreground))',
              }}
            >
              Distribuidora de Embalagens Descartáveis
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={cn('conecta-float hidden shrink-0 rounded-full sm:block', styles.dot)}
              style={{
                backgroundColor: 'hsl(var(--conecta-teal))',
                animationDelay: '0.6s',
              }}
            />
            <span
              className={cn('block min-w-0 font-semibold uppercase tracking-[0.16em]', styles.meta)}
              style={{ color: 'hsl(var(--conecta-muted))' }}
            >
              Artigos para sorveteria e confeitaria
            </span>
          </div>
        </div>
      </div>

      <span
        className="pointer-events-none absolute bottom-0 left-5 right-5 h-px"
        style={{
          backgroundImage:
            'linear-gradient(90deg, transparent, hsl(var(--conecta-accent) / 0.2), transparent)',
        }}
      />
    </div>
  );
}
