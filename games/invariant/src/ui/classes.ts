// Class lists shared by many components.

/** A frosted panel floating over the scene. */
export const CARD = 'rounded-2xl border border-line bg-card shadow-card backdrop-blur-md';

/** A panel's small heading. */
export const CARD_LABEL = 'mb-1.5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-faint';

// Buttons: pick a look and a size. Variants never override each other's
// utilities, so classes don't fight.

type Variant = 'plain' | 'quiet' | 'glass' | 'toy' | 'primary' | 'check';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'none';

const BASE =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-display leading-tight tracking-[0.01em] cursor-pointer transition-[translate,background-color,box-shadow,color] duration-150 disabled:cursor-default disabled:opacity-40 [&_svg]:shrink-0';

const VARIANTS: Record<Variant, string> = {
  plain: 'border border-line bg-white text-ink enabled:hover:bg-sky enabled:active:translate-y-px',
  // quiet buttons keep a faint pill at rest, so their edge is always visible
  // and lines up with what's around them (bare text looks indented by the padding)
  quiet: 'border border-transparent bg-shade/5 text-muted enabled:hover:bg-shade/10 enabled:hover:text-ink enabled:active:translate-y-px',
  // quiet, but right on the scene, where a faint wash would vanish
  glass: 'border border-transparent bg-glass/50 text-muted backdrop-blur-sm enabled:hover:bg-glass/70 enabled:hover:text-ink enabled:active:translate-y-px',
  // chunky, with a solid bottom edge
  toy: 'mb-1 bg-white text-ink shadow-toy enabled:hover:bg-sky enabled:active:translate-y-[3px] enabled:active:shadow-toy-pressed',
  primary: 'mb-1 bg-brand text-white shadow-toy-brand enabled:hover:bg-brand-light enabled:active:translate-y-[3px] enabled:active:shadow-toy-brand-pressed',
  // inside the formula row: raised by half its 3px edge, so it is centred with
  // it; a little less padding on the icon's side, whose glyph has its own margin
  check: 'relative -top-[1.5px] bg-brand pl-4.5 pr-5 py-2 text-md font-semibold text-white shadow-[0_3px_0_var(--color-brand-deep)] enabled:hover:bg-brand-light enabled:active:translate-y-px',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-sm font-medium',
  md: 'px-4 py-2 text-md font-medium',
  // the home screen's two big buttons; on phones they share the row
  lg: 'min-w-44 px-8 py-3.5 text-xl font-semibold max-sm:min-w-0 max-sm:flex-1 max-sm:px-4 max-sm:text-lg',
  // icon only: a circle as tall as the md buttons
  icon: 'size-9',
  none: '',
};

export function button(variant: Variant = 'plain', size: Size = 'md'): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}
