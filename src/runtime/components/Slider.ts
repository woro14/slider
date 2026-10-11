import {
  Comment, Fragment, Text, cloneVNode, computed, defineComponent, h, isVNode, nextTick,
  onBeforeUnmount, onMounted, provide, ref, useId, watch,
} from 'vue'
import type { PropType, VNode, VNodeArrayChildren } from 'vue'
import type { SliderApi, SliderOptions } from '../types'
import { joinSync, sliderKey } from '../utils/context'
import type { ResolvedOptions } from '../utils/options'
import {
  anyIndex, arithmeticMax, breakpointCss, format, indexToPage, measuredWidths, pageCount,
  pageToIndex, resolveBreakpoints, resolveOptions, rootStyle,
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

const svg = (viewBox: string, children: VNodeArrayChildren, style?: string) => h('svg', {
  viewBox, 'width': 24, 'height': 24, 'aria-hidden': 'true', 'focusable': 'false', style,
}, children)
const stroke = (d: string) => h('path', { d, 'fill': 'none', 'stroke': 'currentColor', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })

const ICON_PREV = 'M15 5l-7 7 7 7'
const ICON_NEXT = 'M9 5l7 7-7 7'
const ICON_PAUSE = 'M8 5v14M16 5v14'
const ICON_PLAY = 'M7 4.5v15l12-7.5z'

const mod = (i: number, n: number) => ((i % n) + n) % n

type Source = 'user' | 'sync' | 'scroll'

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
    /** A move starts: (newIndex, prevIndex). */
    move: (_index: number, _prev: number) => true,
    /** A move has settled. */
    moved: (_index: number) => true,
    /** A slide became / stopped being the active one. */
    active: (_index: number) => true,
    inactive: (_index: number) => true,
    /** A slide came into / left the viewport (measured once the move settled). */
    visible: (_index: number) => true,
    hidden: (_index: number) => true,
    /** A slide was clicked (not fired after a mouse drag). */
    click: (_index: number, _event: MouseEvent) => true,
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
    const eagerCount = computed(() => Math.max(...all.value.map(o => measuredWidths(o) ? 1 : o.perPage)))

    const index = ref(base.value.start)
    const selected = ref(base.value.start)
    const hydrated = ref(false)
    const visible = ref<boolean[] | null>(null)
    /** Clones per side for `type: 'loop'`; added once hydrated. */
    const clones = ref(0)
    /** Last reachable index from the real layout (fixed/auto widths, peek). */
    const measuredMax = ref<number | null>(null)
    const playing = ref(false)
    const announcement = ref('')

    const track = ref<HTMLElement>()
    const root = ref<HTMLElement>()
    const isFade = computed(() => options.value.type === 'fade')
    const isLoop = computed(() => options.value.type === 'loop')
    const wraps = computed(() => options.value.rewind || isLoop.value)
    const maxIndex = computed(() => {
      const o = options.value
      if (anyIndex(o)) return Math.max(0, total.value - 1)
      return measuredMax.value ?? arithmeticMax(total.value, o)
    })
    const clamp = (i: number) => Math.min(Math.max(i, 0), maxIndex.value)
    const reducedMotion = ref(false)

    let syncHandle: ReturnType<typeof joinSync> | undefined
    let settleTimer: ReturnType<typeof setTimeout> | undefined
    let movingTimer: ReturnType<typeof setTimeout> | undefined
    let programmatic = false

    function announce() {
      if (playing.value || options.value.isNavigation) return
      announcement.value = format(options.value.i18n.slideX, index.value + 1, total.value)
    }

    // ---- geometry -----------------------------------------------------------
    const kids = () => [...(track.value?.children ?? [])] as HTMLElement[]
    const domIndex = (i: number) => i + clones.value

    function metrics() {
      const t = track.value!
      const cs = getComputedStyle(t)
      return {
        padL: Number.parseFloat(cs.scrollPaddingLeft) || 0,
        padR: Number.parseFloat(cs.scrollPaddingRight) || 0,
        maxScroll: Math.max(0, t.scrollWidth - t.clientWidth),
      }
    }

    /** Scroll position that puts the child at `pos` in its focus position. */
    function targetOf(pos: number, m = metrics()): number {
      const t = track.value!
      const el = t.children[pos] as HTMLElement | undefined
      if (!el) return 0
      const raw = options.value.focus === 'center'
        ? el.offsetLeft + el.offsetWidth / 2 - (m.padL + (t.clientWidth - m.padL - m.padR) / 2)
        : el.offsetLeft - m.padL
      return Math.min(Math.max(raw, 0), m.maxScroll)
    }

    /** Measure which slides are visible and how far the slider can go. */
    function measure() {
      const t = track.value
      const n = total.value
      if (!t || !n) return
      const o = options.value
      let next: boolean[]
      if (isFade.value) {
        next = Array.from({ length: n }, (_, i) => i === index.value)
      }
      else {
        const m = metrics()
        const els = kids()
        const cw = t.clientWidth
        next = Array.from({ length: n }, (_, i) => {
          const el = els[domIndex(i)]
          if (!el) return false
          const left = el.offsetLeft - t.scrollLeft
          const overlap = Math.min(left + el.offsetWidth, cw) - Math.max(left, 0)
          // At least half of the slide (or of the viewport, for wide slides) is in view.
          return overlap >= Math.min(el.offsetWidth, cw) / 2 - 1
        })
        if (!anyIndex(o)) {
          let max = n - 1
          for (let i = 0; i < n; i++) {
            if (targetOf(domIndex(i), m) >= m.maxScroll - 1) { max = i; break }
          }
          measuredMax.value = max
        }
      }
      const prev = visible.value
      if (!prev || prev.some((v, i) => v !== next[i]) || prev.length !== next.length) {
        next.forEach((v, i) => {
          if (!prev || v === !!prev[i]) return
          if (v) emit('visible', i)
          else emit('hidden', i)
        })
        visible.value = next
      }
    }

    /** Jump (no animation) so the active slide is in place, e.g. after a resize. */
    function realign() {
      const t = track.value
      if (!t || isFade.value || drag || programmatic) return
      t.scrollLeft = targetOf(domIndex(index.value))
      measure()
    }

    // ---- moving -------------------------------------------------------------
    function setIndex(next: number, source: Source = 'user') {
      const prev = index.value
      if (next === prev) return
      emit('move', next, prev)
      index.value = next
      emit('inactive', prev)
      emit('active', next)
      if (!options.value.isNavigation) syncHandle?.moved(next)
      if (source !== 'scroll') announce()
      if (isFade.value) {
        measure()
        emit('moved', next)
      }
      else if (source === 'scroll') {
        emit('moved', next)
      }
    }

    function scrollToPos(pos: number) {
      const t = track.value
      if (!t || isFade.value) return
      const left = targetOf(pos)
      if (Math.abs(left - t.scrollLeft) <= 1) return
      programmatic = true
      const smooth = !reducedMotion.value
      if (smooth) {
        // Safari cancels or snaps back a smooth scrollTo() on a mandatory
        // scroll-snap container, so snapping is off until the scroll settles.
        root.value?.classList.add('is-moving')
        clearTimeout(movingTimer)
        movingTimer = setTimeout(() => root.value?.classList.remove('is-moving'), 1500)
      }
      t.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' })
      if (!smooth) {
        // No scroll animation → settle right away.
        nextTick(readIndexFromScroll)
      }
    }

    function go(target: number | '>' | '<', source: Exclude<Source, 'scroll'> = 'user') {
      const o = options.value
      const n = total.value
      if (!n) return
      let next: number
      let pos: number
      if (target === '>' || target === '<') {
        const step = target === '>' ? o.perMove : -o.perMove
        if (isLoop.value) {
          next = mod(index.value + step, n)
          // Move into the clones and jump back once settled: endless in both directions.
          pos = clones.value ? domIndex(index.value) + step : domIndex(next)
          pos = Math.min(Math.max(pos, 0), kids().length - 1)
        }
        else {
          next = index.value + step
          if (next > maxIndex.value) next = wraps.value && index.value >= maxIndex.value ? 0 : maxIndex.value
          else if (next < 0) next = wraps.value && index.value <= 0 ? maxIndex.value : 0
          pos = domIndex(next)
        }
      }
      else {
        next = isLoop.value ? mod(target, n) : clamp(target)
        pos = domIndex(next)
      }
      scrollToPos(pos)
      if (next !== index.value) setIndex(next, source)
      restartAutoplay()
    }

    /** Thumbnail chosen in a navigation slider. */
    function select(i: number) {
      selected.value = i
      syncHandle?.chose(i)
    }

    function highlight(i: number) {
      selected.value = i
      if (options.value.focus === 'center') return go(i, 'sync')
      // Keep the selected thumbnail away from the edges, so the neighbours in
      // both directions come into view (clamped at the start and the end).
      const shown = visible.value?.filter(Boolean).length || options.value.perPage
      go(i - Math.floor((shown - 1) / 2), 'sync')
    }

    // ---- scroll tracking -------------------------------------------------
    function readIndexFromScroll() {
      const t = track.value
      if (!t || isFade.value || drag) return
      root.value?.classList.remove('is-dragging', 'is-moving')
      const n = total.value
      const els = kids()
      if (!n || !els.length) return
      const m = metrics()
      const current = domIndex(index.value)
      let best = current
      let dist = Infinity
      for (let pos = 0; pos < els.length; pos++) {
        const d = Math.abs(targetOf(pos, m) - t.scrollLeft)
        // Several slides can share a clamped position (start / end): keep the current one then.
        if (d < dist - 0.5 || (Math.abs(d - dist) <= 0.5 && pos === current)) {
          dist = d
          best = pos
        }
      }
      let next: number
      if (isLoop.value) {
        next = mod(best - clones.value, n)
        if (best < clones.value || best >= clones.value + n) {
          // Landed on a clone: jump to the real slide, invisible to the user.
          t.scrollLeft = targetOf(domIndex(next), m)
        }
      }
      else {
        next = clamp(best - clones.value)
      }
      if (next !== index.value) setIndex(next, 'scroll')
      else if (programmatic) emit('moved', next)
      programmatic = false
      measure()
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
    let suppressClick = false

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
      if (!wasDrag) return
      suppressClick = true
      const o = options.value
      if (o.drag === 'free' && !o.snap) {
        readIndexFromScroll()
        return
      }
      // Snap in the drag direction, like Splide.
      const t = track.value!
      const m = metrics()
      const els = kids()
      let pos = domIndex(index.value)
      if (Math.abs(dx) >= 20) {
        if (dx < 0) {
          pos = els.findIndex((_, p) => targetOf(p, m) > t.scrollLeft + 1)
          if (pos < 0) pos = els.length - 1
        }
        else {
          for (let p = els.length - 1; p >= 0; p--) {
            if (targetOf(p, m) < t.scrollLeft - 1) { pos = p; break }
            pos = 0
          }
        }
      }
      const n = total.value
      const next = isLoop.value ? mod(pos - clones.value, n) : clamp(pos - clones.value)
      // Snapping stays off until the smooth scroll settles, otherwise the
      // browser snaps back to the slide the drag started on.
      scrollToPos(isLoop.value ? pos : domIndex(next))
      programmatic = true
      if (next !== index.value) setIndex(next, 'user')
      restartAutoplay()
    }
    function onClickCapture(e: MouseEvent) {
      if (suppressClick) {
        e.preventDefault()
        e.stopPropagation()
        suppressClick = false
      }
    }
    function click(i: number, e: MouseEvent) {
      emit('click', i, e)
    }

    // ---- keyboard -----------------------------------------------------------
    function onKeydown(e: KeyboardEvent) {
      const o = options.value
      if (!o.keyboard) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      // The pagination tab list handles its own keys.
      if (o.paginationKeyboard && t.closest('.sl__pagination')) return
      if (o.isNavigation) {
        // Roving focus between thumbnails.
        const buttons = [...(track.value?.querySelectorAll<HTMLButtonElement>('.sl__thumb') ?? [])]
        const at = buttons.indexOf(t as HTMLButtonElement)
        if (at < 0) return
        const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: buttons.length - 1 }[e.key]
        if (to === undefined) return
        e.preventDefault()
        buttons[Math.min(Math.max(to, 0), buttons.length - 1)]!.focus()
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        go(e.key === 'ArrowRight' ? '>' : '<')
      }
    }

    function onPaginationKeydown(e: KeyboardEvent, pages: number, page: number) {
      const to = {
        ArrowRight: (page + 1) % pages,
        ArrowLeft: (page - 1 + pages) % pages,
        Home: 0,
        End: pages - 1,
      }[e.key]
      if (to === undefined) return
      e.preventDefault()
      go(pageToIndex(to, options.value, maxIndex.value))
      // Tabs pattern: focus follows the selection.
      nextTick(() => root.value?.querySelectorAll<HTMLButtonElement>('.sl__dot')[to]?.focus())
    }

    // ---- wheel --------------------------------------------------------------
    let lastWheel = 0
    function onWheel(e: WheelEvent) {
      const o = options.value
      if (!o.wheel) return
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return // horizontal: native scrolling
      if (Math.abs(e.deltaY) < o.wheelMinThreshold) return
      const dir = e.deltaY > 0 ? '>' : '<'
      const blocked = !wraps.value && (dir === '>' ? index.value >= maxIndex.value : index.value <= 0)
      if (blocked && o.releaseWheel) return // let the page scroll on
      e.preventDefault()
      const now = Date.now()
      if (now - lastWheel < o.wheelSleep) return
      lastWheel = now
      if (!blocked) go(dir)
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
      reducedMotion.value = matchMedia('(prefers-reduced-motion: reduce)').matches

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
        el.addEventListener('scroll', onScroll, { passive: true })
        if ('onscrollend' in window) {
          el.addEventListener('scrollend', onScrollEnd)
          el.removeEventListener('scroll', onScroll)
        }
        const ro = new ResizeObserver(() => realign())
        ro.observe(el)
        cleanups.push(() => {
          el.removeEventListener('scroll', onScroll)
          el.removeEventListener('scrollend', onScrollEnd)
          ro.disconnect()
        })
        if (isLoop.value) {
          const n = total.value
          // Enough copies to fill the viewport on either side.
          const need = all.value.some(measuredWidths)
            ? n
            : Math.max(...all.value.map(o => o.perPage)) + (all.value.some(o => o.focus !== undefined) ? 2 : 1)
          clones.value = Math.min(n, need)
        }
      }
      if (!clones.value) realign()
      if (isFade.value) measure()

      if (root.value) {
        const r = root.value
        r.addEventListener('wheel', onWheel, { passive: false })
        cleanups.push(() => r.removeEventListener('wheel', onWheel))
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

    // Clones were added in front: move to the real active slide in the same frame.
    watch(clones, () => realign(), { flush: 'post' })
    // A breakpoint changed the layout.
    watch(matched, () => nextTick(realign), { flush: 'post' })
    watch(maxIndex, (max) => {
      if (!isLoop.value && index.value > max) go(max)
    })

    const api: SliderApi = {
      go: t => go(t),
      play,
      pause,
      get index() { return index.value },
      get length() { return total.value },
    }
    expose(api)

    provide(sliderKey, { id, options, eagerCount, total, index, selected, hydrated, visible, select, click })

    // ---- render -------------------------------------------------------------
    function arrowIcon(dir: 'prev' | 'next', o: ResolvedOptions) {
      const slot = slots[`arrow-${dir}`]
      if (slot) return slot()
      if (o.arrowPath) {
        // Splide's format: 40×40 viewBox, pointing right; mirrored for "previous".
        return [svg('0 0 40 40', [h('path', { d: o.arrowPath, fill: 'currentColor' })], dir === 'prev' ? 'transform:scaleX(-1)' : undefined)]
      }
      return [svg('0 0 24 24', [stroke(dir === 'prev' ? ICON_PREV : ICON_NEXT)])]
    }

    return () => {
      const o = options.value
      const nodes = collectSlides(slots.default?.())
      const n = nodes.length
      if (count.value !== n) count.value = n
      // Until hydrated, the same arithmetic as on the server.
      const max = hydrated.value ? maxIndex.value : arithmeticMax(n, o)
      const css = breakpointCss(`[data-sl="${id}"]`, n, base.value, breakpoints.value)
      const anyArrows = all.value.some(x => x.arrows)
      const anyPagination = !o.isNavigation && all.value.some(x => x.pagination)
      const pages = hydrated.value
        ? pageCount(n, o, max)
        : Math.max(...all.value.map(x => measuredWidths(x) ? n : pageCount(n, x)))
      const page = indexToPage(index.value, o, max, pageCount(n, o, max))
      const trackId = `${id}-track`

      const children: VNode[] = [h('style', { innerHTML: css })]

      if (base.value.autoplay) {
        children.push(h('button', {
          'type': 'button',
          'class': 'sl__toggle',
          'aria-label': playing.value ? o.i18n.pause : o.i18n.play,
          'onClick': () => (playing.value ? pause() : play()),
        }, [svg('0 0 24 24', [stroke(playing.value ? ICON_PAUSE : ICON_PLAY)])]))
      }

      if (anyArrows && n > 1) {
        const atStart = !wraps.value && index.value <= 0
        const atEnd = !wraps.value && index.value >= max
        children.push(h('div', { class: 'sl__arrows' }, [
          h('button', {
            'type': 'button',
            'class': 'sl__arrow sl__arrow--prev',
            'aria-controls': trackId,
            'aria-label': o.rewind && !isLoop.value && index.value <= 0 ? o.i18n.first : o.i18n.prev,
            'aria-disabled': atStart ? 'true' : undefined,
            'onClick': () => !atStart && go('<'),
          }, arrowIcon('prev', o)),
          h('button', {
            'type': 'button',
            'class': 'sl__arrow sl__arrow--next',
            'aria-controls': trackId,
            'aria-label': o.rewind && !isLoop.value && index.value >= max ? o.i18n.last : o.i18n.next,
            'aria-disabled': atEnd ? 'true' : undefined,
            'onClick': () => !atEnd && go('>'),
          }, arrowIcon('next', o)),
        ]))
      }

      const c = clones.value
      const slideVNodes = [
        ...nodes.slice(n - c).map((node, j) => cloneVNode(node, { index: n - c + j, clone: true, key: `clone-a-${j}` })),
        ...nodes.map((node, i) => cloneVNode(node, { index: i, key: node.key ?? i })),
        ...nodes.slice(0, c).map((node, j) => cloneVNode(node, { index: j, clone: true, key: `clone-b-${j}` })),
      ]

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
        // Links and images are natively draggable, which would cancel a mouse drag.
        'onDragstart': (e: DragEvent) => { if (o.drag && !isFade.value) e.preventDefault() },
      }, slideVNodes))

      if (anyPagination && pages > 1) {
        const tabs = o.paginationKeyboard
        const perView = measuredWidths(o) ? 1 : o.perPage
        children.push(h('ul', {
          'class': 'sl__pagination',
          'role': tabs ? 'tablist' : undefined,
          'aria-label': tabs ? o.i18n.select : undefined,
          'onKeydown': tabs ? (e: KeyboardEvent) => onPaginationKeydown(e, pageCount(n, o, max), page) : undefined,
        }, Array.from({ length: pages }, (_, p) => {
          const current = p === page
          const first = pageToIndex(p, o, max)
          const controls = Array.from({ length: Math.min(perView, n) }, (_, k) => `${id}-slide-${mod(first + k, n) + 1}`).join(' ')
          return h('li', { key: p, class: 'sl__page', role: tabs ? 'presentation' : undefined }, [
            h('button', {
              'type': 'button',
              'class': ['sl__dot', { 'is-active': current }],
              'role': tabs ? 'tab' : undefined,
              'aria-controls': tabs ? controls : trackId,
              'aria-label': perView > 1 ? format(o.i18n.pageX, p + 1) : format(o.i18n.goTo, p + 1),
              'aria-selected': tabs ? String(current) : undefined,
              'aria-current': !tabs && current ? 'true' : undefined,
              // Tabs pattern: only the selected dot is a tab stop.
              'tabindex': tabs && !current ? -1 : undefined,
              'onClick': () => go(pageToIndex(p, o, max)),
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
          'sl--center': o.focus === 'center',
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
