/**
 * Options are named after Splide's options so existing configs can be moved
 * over with little change. Anything not listed here is not supported (yet).
 */
export interface SliderOptions {
  /**
   * `slide`: native scroll-snap track (default).
   * `loop`: endless; slides are cloned on both ends once JavaScript runs.
   * `fade`: slides are stacked and cross-faded, one per view.
   */
  type?: 'slide' | 'loop' | 'fade'
  /** Wrap from the last slide back to the first (not needed with `type: 'loop'`). */
  rewind?: boolean
  /** Slides visible per page. Ignored with `fixedWidth` / `autoWidth`. */
  perPage?: number
  /** Slides moved per arrow click / autoplay step. Defaults to `perPage`. */
  perMove?: number
  /** Gap between slides, any CSS length. */
  gap?: string | number
  /** Peek of the neighbouring slides, any CSS length (or `{ left, right }`). */
  padding?: string | number | { left?: string | number, right?: string | number }
  /**
   * Where the active slide sits: `'center'`, or a number of slides from the
   * left edge (like Splide). Unset aligns the active slide to the left.
   */
  focus?: 'center' | number
  /** Index of the slide shown first. */
  start?: number
  /** Fixed slide width (any CSS length); `perPage` is ignored. */
  fixedWidth?: string | number
  /** Slide width comes from its content; `perPage` is ignored. */
  autoWidth?: boolean
  /** Fixed slide height (any CSS length). Alias: `fixedHeight`. */
  height?: string | number
  fixedHeight?: string | number
  /** Height as a ratio of the slider width, e.g. `9 / 16`. Reserves space → no CLS. */
  heightRatio?: number
  /** Show previous/next buttons. */
  arrows?: boolean
  /**
   * SVG path for the arrows, drawn in a 40×40 viewBox and pointing right
   * (like Splide). The previous arrow is mirrored. Or use the `arrow-prev` /
   * `arrow-next` slots for any markup.
   */
  arrowPath?: string
  /** Show pagination dots. */
  pagination?: boolean
  /**
   * Pagination as an ARIA tab list: one tab stop, arrow keys / Home / End
   * move between the dots (default, like Splide). `false` renders plain buttons.
   */
  paginationKeyboard?: boolean
  /** Rotate automatically. Never starts when the user prefers reduced motion. */
  autoplay?: boolean
  /** Autoplay interval in ms. */
  interval?: number
  pauseOnHover?: boolean
  pauseOnFocus?: boolean
  /**
   * Allow dragging with the mouse; touch swiping is always native.
   * `'free'` turns off snapping (free scrolling, momentum on touch).
   */
  drag?: boolean | 'free'
  /** With `drag: 'free'`: snap to the nearest slide after a mouse drag. */
  snap?: boolean
  /** Move with the vertical mouse wheel. */
  wheel?: boolean
  /** Minimum wheel delta that triggers a move. */
  wheelMinThreshold?: number
  /** Pause between wheel moves in ms. */
  wheelSleep?: number
  /** Let the page scroll on when the wheel reaches the first/last slide (default `true`). */
  releaseWheel?: boolean
  /** Transition duration for `fade` in ms. Scrolling uses the browser's smooth scroll. */
  speed?: number
  /** Arrow keys move the slider while focus is inside it. */
  keyboard?: boolean
  /** Turn the slider into a thumbnail navigation for the slider with the same `sync` id. */
  isNavigation?: boolean
  /** Options per breakpoint, keyed by pixel width. */
  breakpoints?: Record<number, Omit<SliderOptions, 'breakpoints' | 'mediaQuery' | 'type' | 'isNavigation'>>
  /** `max` (default, like Splide) or `min` width media queries for `breakpoints`. */
  mediaQuery?: 'max' | 'min'
  /** Accessible labels. `%s` is replaced by a number. */
  i18n?: Partial<SliderI18n>
}

export interface SliderI18n {
  carousel: string
  slide: string
  slideLabel: string
  prev: string
  next: string
  first: string
  last: string
  goTo: string
  pageX: string
  play: string
  pause: string
  slideX: string
  /** Label of the pagination tab list. */
  select: string
}

export interface SliderApi {
  /** Go to an index, or `'>'` / `'<'` for next / previous page. */
  go: (target: number | '>' | '<') => void
  play: () => void
  pause: () => void
  readonly index: number
  readonly length: number
}
