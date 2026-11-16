export const CARD = 'rounded-2xl border border-line bg-card shadow-card backdrop-blur-md';

export const CARD_LABEL = 'mb-1.5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-faint';

export const PILL = 'flex items-center rounded-full border border-line bg-card p-1 shadow-card backdrop-blur-md';

export const FOLD = 'duration-340 ease-fold motion-reduce:transition-none';
export const FOLD_MS = 340;
export const FOLD_EASE = 'cubic-bezier(0.2,0.8,0.2,1)';

type Variant = 'plain' | 'quiet' | 'glass' | 'toy' | 'primary';
type Size = 'sm' | 'md' | 'lg' | 'none';

export const BUTTON =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-display leading-tight tracking-[0.01em] cursor-pointer transition-[translate,background-color,box-shadow,color,opacity] duration-150 disabled:cursor-default disabled:opacity-40 [&_svg]:shrink-0';

const VARIANTS: Record<Variant, string> = {
  plain: 'border border-line bg-white text-ink enabled:hover:bg-sky enabled:active:translate-y-px',
  quiet: 'border border-transparent bg-shade/5 text-muted enabled:hover:bg-shade/10 enabled:hover:text-ink enabled:active:translate-y-px',
  glass: 'border border-transparent bg-glass/50 text-muted backdrop-blur-sm enabled:hover:bg-glass/70 enabled:hover:text-ink enabled:active:translate-y-px',
  toy: 'mb-1 bg-white text-ink shadow-toy enabled:hover:bg-sky enabled:active:translate-y-[3px] enabled:active:shadow-toy-pressed',
  primary: 'mb-1 bg-brand text-white shadow-toy-brand enabled:hover:bg-brand-light enabled:active:translate-y-[3px] enabled:active:shadow-toy-brand-pressed',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-sm font-medium',
  md: 'px-4 py-2 text-md font-medium compact:px-3 compact:py-1.75 compact:text-sm max-xs:px-2.5',
  lg: 'min-w-44 px-8 py-3.5 text-xl font-semibold max-sm:min-w-0 max-sm:flex-1 max-sm:px-4 max-sm:text-lg short:min-w-36 short:px-6 short:py-2.5 short:text-lg',
  none: '',
};

export function button(variant: Variant = 'plain', size: Size = 'md'): string {
  return `${BUTTON} ${VARIANTS[variant]} ${SIZES[size]}`;
}
