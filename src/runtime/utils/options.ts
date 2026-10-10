import type { SliderI18n, SliderOptions } from '../types'

export const defaultI18n: SliderI18n = {
  carousel: 'carousel',
  slide: 'slide',
  slideLabel: '%s of %s',
  prev: 'Previous slide',
  next: 'Next slide',
  first: 'Go to last slide',
  last: 'Go to first slide',
  goTo: 'Go to slide %s',
  pageX: 'Go to page %s',
  play: 'Start autoplay',
  pause: 'Pause autoplay',
  slideX: 'Slide %s of %s',
}

export interface ResolvedOptions {
  type: 'slide' | 'loop' | 'fade'
  rewind: boolean
  perPage: number
  perMove: number
  gap: string
  padLeft: string
  padRight: string
  start: number
  height: string | undefined
  heightRatio: number | undefined
  arrows: boolean
  pagination: boolean
  autoplay: boolean
  interval: number
  pauseOnHover: boolean
  pauseOnFocus: boolean
  drag: boolean
  speed: number
  keyboard: boolean
  isNavigation: boolean
  i18n: SliderI18n
}

/** A breakpoint after merging, with the media query it applies under. */
export interface ResolvedBreakpoint {
  query: string
  options: ResolvedOptions
}

export function cssLength(value: string | number | undefined, fallback = '0px'): string {
  if (value === undefined || value === null || value === '') return fallback
  return typeof value === 'number' ? `${value}px` : value
}

function apply(base: ResolvedOptions, input: SliderOptions): ResolvedOptions {
  const out = { ...base }
  if (input.type !== undefined) out.type = input.type
  if (input.rewind !== undefined) out.rewind = input.rewind
  if (input.perPage !== undefined) out.perPage = Math.max(1, Math.floor(input.perPage))
  if (input.perMove !== undefined) out.perMove = Math.max(1, Math.floor(input.perMove))
  else if (input.perPage !== undefined) out.perMove = out.perPage
  if (input.gap !== undefined) out.gap = cssLength(input.gap)
  if (input.padding !== undefined) {
    if (typeof input.padding === 'object') {
      out.padLeft = cssLength(input.padding.left)
      out.padRight = cssLength(input.padding.right)
    }
    else {
      out.padLeft = out.padRight = cssLength(input.padding)
    }
  }
  if (input.start !== undefined) out.start = Math.max(0, Math.floor(input.start))
  if (input.height !== undefined) out.height = cssLength(input.height)
  if (input.heightRatio !== undefined) out.heightRatio = input.heightRatio
  if (input.arrows !== undefined) out.arrows = input.arrows
  if (input.pagination !== undefined) out.pagination = input.pagination
  if (input.autoplay !== undefined) out.autoplay = input.autoplay
  if (input.interval !== undefined) out.interval = input.interval
  if (input.pauseOnHover !== undefined) out.pauseOnHover = input.pauseOnHover
  if (input.pauseOnFocus !== undefined) out.pauseOnFocus = input.pauseOnFocus
  if (input.drag !== undefined) out.drag = input.drag
  if (input.speed !== undefined) out.speed = input.speed
  if (input.keyboard !== undefined) out.keyboard = input.keyboard
  if (input.isNavigation !== undefined) out.isNavigation = input.isNavigation
  if (input.i18n) out.i18n = { ...out.i18n, ...input.i18n }
  if (out.type === 'fade') {
    out.perPage = 1
    out.perMove = 1
  }
  return out
}

export function resolveOptions(input: SliderOptions = {}): ResolvedOptions {
  const defaults: ResolvedOptions = {
    type: 'slide',
    rewind: false,
    perPage: 1,
    perMove: 1,
    gap: '0px',
    padLeft: '0px',
    padRight: '0px',
    start: 0,
    height: undefined,
    heightRatio: undefined,
    arrows: true,
    pagination: true,
    autoplay: false,
    interval: 5000,
    pauseOnHover: true,
    pauseOnFocus: true,
    drag: true,
    speed: 400,
    keyboard: true,
    isNavigation: false,
    i18n: defaultI18n,
  }
  return apply(defaults, input)
}

/**
 * Splide merges breakpoints on top of each other: with `max` queries the
 * smaller breakpoints win, with `min` queries the larger ones. We return them
 * in cascade order, each already merged with everything that also matches.
 */
export function resolveBreakpoints(input: SliderOptions = {}, base = resolveOptions(input)): ResolvedBreakpoint[] {
  const mode = input.mediaQuery ?? 'max'
  const entries = Object.entries(input.breakpoints ?? {})
    .map(([w, o]) => [Number(w), o] as const)
    .filter(([w]) => Number.isFinite(w))
    .sort((a, b) => (mode === 'max' ? b[0] - a[0] : a[0] - b[0]))

  const out: ResolvedBreakpoint[] = []
  let current = base
  for (const [width, opts] of entries) {
    current = apply(current, { ...opts, type: base.type })
    out.push({
      query: mode === 'max' ? `(max-width: ${width}px)` : `(min-width: ${width}px)`,
      options: current,
    })
  }
  return out
}

export function pageCount(total: number, o: Pick<ResolvedOptions, 'perPage' | 'perMove'>): number {
  if (total <= o.perPage) return 1
  return Math.ceil((total - o.perPage) / o.perMove) + 1
}

export function pageToIndex(page: number, total: number, o: Pick<ResolvedOptions, 'perPage' | 'perMove'>): number {
  return Math.min(page * o.perMove, Math.max(0, total - o.perPage))
}

export function indexToPage(index: number, total: number, o: Pick<ResolvedOptions, 'perPage' | 'perMove'>): number {
  const last = pageCount(total, o) - 1
  if (index >= Math.max(0, total - o.perPage)) return last
  return Math.min(last, Math.floor(index / o.perMove))
}

export function format(template: string, ...values: (string | number)[]): string {
  let i = 0
  return template.replace(/%s/g, () => String(values[i++] ?? ''))
}

function vars(o: ResolvedOptions): string {
  const decl = [
    `--sl-per-page:${o.perPage}`,
    `--sl-gap:${o.gap}`,
    `--sl-pad-l:${o.padLeft}`,
    `--sl-pad-r:${o.padRight}`,
    `--sl-arrows:${o.arrows ? 'flex' : 'none'}`,
  ]
  decl.push(`--sl-slide-h:${o.height ?? (o.heightRatio ? `calc(${o.heightRatio} * 100cqw)` : 'auto')}`)
  return decl.join(';')
}

/** Inline style for the root. Layout variables live in `breakpointCss` so media queries can override them. */
export function rootStyle(o: ResolvedOptions): string {
  return `--sl-speed:${o.speed}ms`
}

/**
 * Per-breakpoint CSS. Rendered on the server so the layout is final before
 * any JavaScript runs: no layout shift when the component hydrates later.
 * Pagination dots for every breakpoint are rendered and the surplus is hidden.
 */
export function breakpointCss(selector: string, total: number, base: ResolvedOptions, bps: ResolvedBreakpoint[]): string {
  const rule = (o: ResolvedOptions) => {
    const pages = pageCount(total, o)
    const show = o.pagination && pages > 1
    return `${selector}{${vars(o)};--sl-pagination:${show ? 'flex' : 'none'}}`
      + `${selector} .sl__page:nth-child(n){display:list-item}`
      + `${selector} .sl__page:nth-child(n+${pages + 1}){display:none}`
  }
  let css = rule(base)
  for (const bp of bps) css += `@media ${bp.query}{${rule(bp.options)}}`
  return css
}
