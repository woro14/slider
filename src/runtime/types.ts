/**
 * Options are named after Splide's options so existing configs can be moved
 * over with little change. Anything not listed here is not supported (yet).
 */
export interface SliderOptions {
  /**
   * `slide`: native scroll-snap track (default).
   * `loop`: like `slide`, but next/prev and autoplay wrap around.
   * `fade`: slides are stacked and cross-faded, one per view.
   */
  type?: 'slide' | 'loop' | 'fade'
  /** Wrap from the last slide back to the first (implied by `type: 'loop'`). */
  rewind?: boolean
  /** Slides visible per page. */
  perPage?: number
  /** Slides moved per arrow click / autoplay step. Defaults to `perPage`. */
  perMove?: number
  /** Gap between slides, any CSS length. */
  gap?: string | number
  /** Peek of the neighbouring slides, any CSS length (or `{ left, right }`). */
  padding?: string | number | { left?: string | number, right?: string | number }
  /** Index of the slide shown first. */
  start?: number
  /** Fixed track height (any CSS length). Use with `cover` images. */
  height?: string | number
  /** Height as a ratio of the slide width, e.g. `9 / 16`. Reserves space → no CLS. */
  heightRatio?: number
  /** Show previous/next buttons. */
  arrows?: boolean
  /** Show pagination dots. */
  pagination?: boolean
  /** Rotate automatically. Never starts when the user prefers reduced motion. */
  autoplay?: boolean
  /** Autoplay interval in ms. */
  interval?: number
  pauseOnHover?: boolean
  pauseOnFocus?: boolean
  /** Allow dragging with the mouse. Touch swiping is always native. */
  drag?: boolean
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
}

export interface SliderApi {
  /** Go to an index, or `'>'` / `'<'` for next / previous page. */
  go: (target: number | '>' | '<') => void
  play: () => void
  pause: () => void
  readonly index: number
  readonly length: number
}
