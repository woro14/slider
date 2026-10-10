import {
  Comment, Fragment, Text, cloneVNode, computed, defineComponent, h, isVNode,
  onBeforeUnmount, onMounted, provide, ref, useId, watch,
} from 'vue'
import type { PropType, VNode } from 'vue'
import type { SliderApi, SliderOptions } from '../types'
import { joinSync, sliderKey } from '../utils/context'
import {
  breakpointCss, format, indexToPage, pageCount, pageToIndex,
  resolveBreakpoints, resolveOptions, rootStyle,
} from '../utils/options'
import SliderSlide from './SliderSlide'

/** Flatten v-for fragments and wrap plain children in <SliderSlide>. */
function collectSlides(nodes: VNode[] = [], out: VNode[] = []): VNode[] {
  for (const node of nodes) {
    if (!isVNode(node) || node.type === Comment) continue
    if (node.type === Fragment) {
      collectSlides(node.children as VNode[], out)
      continue
    }
    if (node.type === Text && !String(node.children).trim()) continue
    out.push(node.type === SliderSlide ? node : h(SliderSlide, null, () => node))
  }
  return out
}

const icon = (d: string) => h('svg', {
  'viewBox': '0 0 24 24', 'width': 24, 'height': 24, 'aria-hidden': 'true', 'focusable': 'false',
}, [h('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })])

const ICON_PREV = 'M15 5l-7 7 7 7'
const ICON_NEXT = 'M9 5l7 7-7 7'
const ICON_PAUSE = 'M8 5v14M16 5v14'
const ICON_PLAY = 'M7 4.5v15l12-7.5z'

export default defineComponent({
  name: 'Slider',
  props: {
    options: { type: Object as PropType<SliderOptions>, default: () => ({}) },
    /** Accessible name of the carousel (or use `aria-labelledby`). */
    label: { type: String, default: undefined },
    /** Sliders with the same id are synced (thumbnails). */
    sync: { type: String, default: undefined },
    tag: { type: String, default: 'section' },
  },
  emits: {
    /** Fired when a move starts: (newIndex, prevIndex). */
    move: (_index: number, _prev: number) => true,
    /** Fired when a move has settled. */
    moved: (_index: number) => true,
    mounted: (_api: SliderApi) => true,
    'autoplay:play': () => true,
    'autoplay:pause': () => true,
  },
  setup(props, { slots, emit, expose, attrs }) {
    const id = `sl-${useId()}`
    const base = computed(() => resolveOptions(props.options))
    const breakpoints = computed(() => resolveBreakpoints(props.options, base.value))
    // Server render and first client render always use the base options so
    // hydration matches; breakpoint CSS already shows the right layout.
    const matched = ref(-1)
    const options = computed(() => matched.value < 0 ? base.value : breakpoints.value[matched.value]!.options)
    const all = computed(() => [base.value, ...breakpoints.value.map(b => b.options)])

    // Written during render (children read it in their own render); the
    // root render itself never reads it, so this does not loop.
    const count = ref(0)
    const total = computed(() => count.value)
    const eagerCount = computed(() => Math.max(...all.value.map(o => o.perPage)))

    const maxIndex = computed(() => Math.max(0, total.value - options.value.perPage))
    const clamp = (i: number) => Math.min(Math.max(i, 0), maxIndex.value)
    const index = ref(base.value.start)
    const selected = ref(base.value.start)
    const hydrated = ref(false)
    const playing = ref(false)
    const announcement = ref('')

    const track = ref<HTMLElement>()
    const root = ref<HTMLElement>()
    const wraps = computed(() => options.value.rewind || options.value.type === 'loop')
    const isFade = computed(() => options.value.type === 'fade')
    const reducedMotion = ref(false)

    let syncHandle: ReturnType<typeof joinSync> | undefined
    let settleTimer: ReturnType<typeof setTimeout> | undefined
    let movingTimer: ReturnType<typeof setTimeout> | undefined
    let programmatic = false

    function announce() {
      if (playing.value || options.value.isNavigation) return
      announcement.value = format(options.value.i18n.slideX, index.value + 1, total.value)
    }

    function slideOffset(i: number): number {
      const el = track.value
      const slide = el?.children[i] as HTMLElement | undefined
      if (!el || !slide) return 0
      const padLeft = Number.parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0
      return slide.offsetLeft - padLeft
    }

    function setIndex(next: number, source: 'user' | 'sync' | 'scroll' = 'user') {
      const prev = index.value
      if (next === prev) return
      emit('move', next, prev)
      index.value = next
      if (!options.value.isNavigation) syncHandle?.moved(next)
      if (source !== 'scroll') announce()
      if (isFade.value || source === 'scroll') emit('moved', next)
    }

    function go(target: number | '>' | '<', source: 'user' | 'sync' = 'user') {
      const o = options.value
      let next: number
      if (target === '>' || target === '<') {
        const step = target === '>' ? o.perMove : -o.perMove
        next = index.value + step
        if (next > maxIndex.value) next = wraps.value && index.value >= maxIndex.value ? 0 : maxIndex.value
        else if (next < 0) next = wraps.value && index.value <= 0 ? maxIndex.value : 0
      }
      else {
        next = clamp(target)
      }

      if (!isFade.value && track.value) {
        const left = slideOffset(next)
        if (Math.abs(left - track.value.scrollLeft) > 1) {
          programmatic = true
          // Safari cancels or snaps back a smooth scrollTo() on a mandatory
          // scroll-snap container, so snapping is off until the scroll settles.
          root.value?.classList.add('is-moving')
          clearTimeout(movingTimer)
          movingTimer = setTimeout(() => root.value?.classList.remove('is-moving'), 1500)
          track.value.scrollTo({ left, behavior: reducedMotion.value ? 'auto' : 'smooth' })
        }
      }
      if (next !== index.value) setIndex(next, source)
      else if (!isFade.value) programmatic = false
      restartAutoplay()
    }

    /** Thumbnail chosen in a navigation slider. */
    function select(i: number) {
      selected.value = i
      syncHandle?.chose(i)
    }

    function highlight(i: number) {
      selected.value = i
      // Like Splide: the navigation follows the selection (clamped at the end),
      // so the next thumbnails come into view.
      go(i, 'sync')
    }

    // ---- scroll tracking -------------------------------------------------
    function readIndexFromScroll() {
      const el = track.value
      if (!el || isFade.value || drag) return
      root.value?.classList.remove('is-dragging', 'is-moving')
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2
      let best = 0
      let dist = Infinity
      for (let i = 0; i < total.value; i++) {
        const d = Math.abs(slideOffset(i) - el.scrollLeft)
        if (d < dist) { dist = d; best = i }
      }
      const next = atEnd ? maxIndex.value : clamp(best)
      if (next !== index.value) setIndex(next, 'scroll')
      else if (programmatic) emit('moved', next)
      programmatic = false
    }

    function onScroll() {
      // Fallback for browsers without `scrollend`.
      clearTimeout(settleTimer)
      settleTimer = setTimeout(readIndexFromScroll, 120)
    }
    function onScrollEnd() {
      clearTimeout(settleTimer)
      readIndexFromScroll()
    }

    // ---- mouse drag (touch swiping is native scrolling) -------------------
    let drag: { x: number, left: number, moved: boolean, id: number } | null = null
    function onPointerDown(e: PointerEvent) {
      const o = options.value
      if (e.button !== 0) return
      if (isFade.value) {
        drag = { x: e.clientX, left: 0, moved: false, id: e.pointerId }
        return
      }
      if (!o.drag || e.pointerType !== 'mouse' || !track.value) return
      drag = { x: e.clientX, left: track.value.scrollLeft, moved: false, id: e.pointerId }
    }
    function onPointerMove(e: PointerEvent) {
      if (!drag || isFade.value || !track.value) return
      const dx = e.clientX - drag.x
      if (!drag.moved && Math.abs(dx) > 5) {
        drag.moved = true
        track.value.setPointerCapture(drag.id)
        root.value?.classList.add('is-dragging')
      }
      if (drag.moved) track.value.scrollLeft = drag.left - dx
    }
    function onPointerUp(e: PointerEvent) {
      if (!drag) return
      const dx = e.clientX - drag.x
      const wasDrag = drag.moved
      drag = null
      if (isFade.value) {
        if (Math.abs(dx) > 40) go(dx < 0 ? '>' : '<')
        return
      }
      if (wasDrag) {
        suppressClick = true
        // Snap in the drag direction, like Splide.
        const near = (() => {
          const el = track.value!
          let best = index.value
          for (let i = 0; i <= maxIndex.value; i++) {
            const off = slideOffset(i)
            if (dx < 0 ? off > el.scrollLeft - 1 : off < el.scrollLeft + 1) {
              best = i
              if (dx < 0) break
            }
          }
          return best
        })()
        // Snapping stays off until the smooth scroll settles, otherwise the
        // browser snaps back to the slide the drag started on.
        go(Math.abs(dx) < 20 ? index.value : near)
        programmatic = true
      }
    }
    let suppressClick = false
    function onClickCapture(e: MouseEvent) {
      if (suppressClick) {
        e.preventDefault()
        e.stopPropagation()
        suppressClick = false
      }
    }

    // ---- keyboard -----------------------------------------------------------
    function onKeydown(e: KeyboardEvent) {
      if (!options.value.keyboard) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        if (options.value.isNavigation) {
          // Roving focus between thumbnails.
          const buttons = [...(track.value?.querySelectorAll<HTMLButtonElement>('.sl__thumb') ?? [])]
          const at = buttons.indexOf(t as HTMLButtonElement)
          if (at < 0) return
          const next = Math.min(Math.max(at + (e.key === 'ArrowRight' ? 1 : -1), 0), buttons.length - 1)
          buttons[next]!.focus()
          return
        }
        go(e.key === 'ArrowRight' ? '>' : '<')
      }
    }

    // ---- autoplay ---------------------------------------------------------
    let timer: ReturnType<typeof setTimeout> | undefined
    const pausedBy = new Set<'user' | 'hover' | 'focus' | 'hidden' | 'offscreen'>()

    function schedule() {
      clearTimeout(timer)
      if (!playing.value || pausedBy.size) return
      timer = setTimeout(() => {
        if (!wraps.value && index.value >= maxIndex.value) go(0)
        else go('>')
      }, options.value.interval)
    }
    function restartAutoplay() {
      if (playing.value) schedule()
    }
    function play() {
      pausedBy.delete('user')
      if (!playing.value) emit('autoplay:play')
      playing.value = true
      announcement.value = ''
      schedule()
    }
    function pause() {
      pausedBy.add('user')
      if (playing.value) emit('autoplay:pause')
      playing.value = false
      clearTimeout(timer)
    }
    function hold(reason: 'hover' | 'focus' | 'hidden' | 'offscreen', on: boolean) {
      if (on) pausedBy.add(reason)
      else pausedBy.delete(reason)
      if (pausedBy.size) clearTimeout(timer)
      else schedule()
    }

    // ---- lifecycle ----------------------------------------------------------
    const cleanups: (() => void)[] = []
    onMounted(() => {
      const mqMotion = matchMedia('(prefers-reduced-motion: reduce)')
      reducedMotion.value = mqMotion.matches

      const queries = breakpoints.value.map(b => matchMedia(b.query))
      const update = () => {
        let m = -1
        queries.forEach((q, i) => { if (q.matches) m = i })
        // With merged cascade order, the last matching breakpoint wins.
        matched.value = m
      }
      update()
      queries.forEach(q => q.addEventListener('change', update))
      cleanups.push(() => queries.forEach(q => q.removeEventListener('change', update)))

      hydrated.value = true

      const el = track.value
      if (el && !isFade.value) {
        if (index.value) el.scrollLeft = slideOffset(index.value)
        el.addEventListener('scroll', onScroll, { passive: true })
        if ('onscrollend' in window) {
          el.addEventListener('scrollend', onScrollEnd)
          el.removeEventListener('scroll', onScroll)
        }
        cleanups.push(() => {
          el.removeEventListener('scroll', onScroll)
          el.removeEventListener('scrollend', onScrollEnd)
        })
      }

      if (base.value.autoplay && root.value) {
        const r = root.value
        const enter = () => options.value.pauseOnHover && hold('hover', true)
        const leave = () => hold('hover', false)
        const focusIn = () => options.value.pauseOnFocus && hold('focus', true)
        const focusOut = (e: FocusEvent) => {
          if (!r.contains(e.relatedTarget as Node)) hold('focus', false)
        }
        const vis = () => hold('hidden', document.hidden)
        r.addEventListener('mouseenter', enter)
        r.addEventListener('mouseleave', leave)
        r.addEventListener('focusin', focusIn)
        r.addEventListener('focusout', focusOut)
        document.addEventListener('visibilitychange', vis)
        const io = new IntersectionObserver(([entry]) => hold('offscreen', !entry!.isIntersecting))
        io.observe(r)
        cleanups.push(() => {
          r.removeEventListener('mouseenter', enter)
          r.removeEventListener('mouseleave', leave)
          r.removeEventListener('focusin', focusIn)
          r.removeEventListener('focusout', focusOut)
          document.removeEventListener('visibilitychange', vis)
          io.disconnect()
        })
        // WCAG 2.2.2 / 2.3.3: never start moving on its own for reduced-motion users.
        if (!reducedMotion.value) {
          playing.value = true
          emit('autoplay:play')
          schedule()
        }
        else {
          pausedBy.add('user')
        }
      }

      if (props.sync) {
        syncHandle = joinSync(props.sync, {
          isNavigation: () => options.value.isNavigation,
          go: i => go(i, 'sync'),
          highlight,
          currentIndex: () => options.value.isNavigation ? selected.value : index.value,
        })
      }

      emit('mounted', api)
    })

    onBeforeUnmount(() => {
      clearTimeout(timer)
      clearTimeout(settleTimer)
      clearTimeout(movingTimer)
      syncHandle?.leave()
      cleanups.forEach(fn => fn())
    })

    watch(maxIndex, (max) => {
      if (index.value > max) go(max)
    })

    const api: SliderApi = {
      go: t => go(t),
      play,
      pause,
      get index() { return index.value },
      get length() { return total.value },
    }
    expose(api)

    provide(sliderKey, { id, options, eagerCount, total, index, selected, hydrated, select })

    // ---- render -------------------------------------------------------------
    return () => {
      const o = options.value
      const nodes = collectSlides(slots.default?.())
      const n = nodes.length
      if (count.value !== n) count.value = n
      const max = Math.max(0, n - o.perPage)
      const css = breakpointCss(`[data-sl="${id}"]`, n, base.value, breakpoints.value)
      const anyArrows = all.value.some(x => x.arrows)
      const anyPagination = !o.isNavigation && all.value.some(x => x.pagination)
      const maxPages = Math.max(...all.value.map(x => pageCount(n, x)))
      const page = indexToPage(index.value, n, o)
      const trackId = `${id}-track`

      const children: VNode[] = [h('style', { innerHTML: css })]

      if (base.value.autoplay) {
        children.push(h('button', {
          'type': 'button',
          'class': 'sl__toggle',
          'aria-label': playing.value ? o.i18n.pause : o.i18n.play,
          'onClick': () => (playing.value ? pause() : play()),
        }, [icon(playing.value ? ICON_PAUSE : ICON_PLAY)]))
      }

      if (anyArrows && n > 1) {
        const atStart = !wraps.value && index.value <= 0
        const atEnd = !wraps.value && index.value >= max
        children.push(h('div', { class: 'sl__arrows' }, [
          h('button', {
            'type': 'button',
            'class': 'sl__arrow sl__arrow--prev',
            'aria-controls': trackId,
            'aria-label': wraps.value && index.value <= 0 ? o.i18n.first : o.i18n.prev,
            'aria-disabled': atStart ? 'true' : undefined,
            'onClick': () => !atStart && go('<'),
          }, [icon(ICON_PREV)]),
          h('button', {
            'type': 'button',
            'class': 'sl__arrow sl__arrow--next',
            'aria-controls': trackId,
            'aria-label': wraps.value && index.value >= max ? o.i18n.last : o.i18n.next,
            'aria-disabled': atEnd ? 'true' : undefined,
            'onClick': () => !atEnd && go('>'),
          }, [icon(ICON_NEXT)]),
        ]))
      }

      children.push(h('div', {
        'ref': track,
        'id': trackId,
        'class': 'sl__track',
        // Scrollable regions must be reachable by keyboard (axe: scrollable-region-focusable).
        'tabindex': isFade.value || o.isNavigation ? undefined : 0,
        'onPointerdown': onPointerDown,
        'onPointermove': onPointerMove,
        'onPointerup': onPointerUp,
        'onPointercancel': onPointerUp,
        'onClickCapture': onClickCapture,
      }, nodes.map((node, i) => cloneVNode(node, { index: i, key: node.key ?? i }))))

      if (anyPagination && maxPages > 1) {
        children.push(h('ul', { class: 'sl__pagination' }, Array.from({ length: maxPages }, (_, p) => {
          const current = p === page
          return h('li', { key: p, class: 'sl__page' }, [
            h('button', {
              'type': 'button',
              'class': ['sl__dot', { 'is-active': current }],
              'aria-controls': trackId,
              'aria-label': o.perPage > 1 ? format(o.i18n.pageX, p + 1) : format(o.i18n.goTo, p + 1),
              'aria-current': current ? 'true' : undefined,
              'onClick': () => go(pageToIndex(p, n, o)),
            }),
          ])
        })))
      }

      // Announces user-initiated changes; silent while autoplay runs.
      children.push(h('div', { 'class': 'sl__sr', 'aria-live': 'polite', 'aria-atomic': 'true' }, announcement.value))

      const labelled = attrs['aria-labelledby'] !== undefined
      return h(props.tag, {
        'ref': root,
        'class': ['sl', `sl--${o.type}`, {
          'sl--nav': o.isNavigation,
          'is-ready': hydrated.value,
          'is-playing': playing.value,
        }],
        'data-sl': id,
        'style': rootStyle(o),
        'aria-roledescription': o.isNavigation ? undefined : o.i18n.carousel,
        'role': o.isNavigation ? 'group' : 'region',
        'aria-label': labelled ? undefined : props.label,
        'onKeydown': onKeydown,
      }, children)
    }
  },
})
