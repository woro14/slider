import { computed, defineComponent, h, inject } from 'vue'
import { sliderKey } from '../utils/context'
import { format } from '../utils/options'

export default defineComponent({
  name: 'SliderSlide',
  props: {
    /** Set by the parent `<Slider>`; you never pass it yourself. */
    index: { type: Number, default: 0 },
    tag: { type: String, default: 'div' },
  },
  setup(props, { slots }) {
    const ctx = inject(sliderKey, null)
    if (!ctx) throw new Error('<SliderSlide> must be used inside <Slider>')

    const state = computed(() => {
      const o = ctx.options.value
      const i = props.index
      const total = ctx.total.value
      const nav = o.isNavigation
      const fade = o.type === 'fade'
      const active = nav
        ? ctx.selected.value === i
        : fade
          ? ctx.index.value === i
          : i >= ctx.index.value && i < ctx.index.value + o.perPage
      const isFirst = i === o.start
      return { o, i, total, nav, active, isFirst }
    })

    return () => {
      const { o, i, total, nav, active, isFirst } = state.value
      // Above-the-fold images: the first slide is the likely LCP element.
      const eager = !nav && i >= o.start && i < o.start + ctx.eagerCount.value
      const imgAttrs = {
        loading: eager ? 'eager' : 'lazy',
        fetchpriority: isFirst && !nav ? 'high' : undefined,
        decoding: 'async',
        draggable: 'false',
      } as const
      const content = slots.default?.({ index: i, active, imgAttrs })

      const classes = ['sl__slide', { 'is-active': active }]

      if (nav) {
        return h(props.tag, { class: classes }, [
          h('button', {
            'type': 'button',
            'class': 'sl__thumb',
            'aria-label': format(o.i18n.goTo, i + 1),
            'aria-current': active ? 'true' : undefined,
            'onClick': () => ctx.select(i),
          }, content),
        ])
      }

      // Hidden slides are removed from tab order and the accessibility tree,
      // but only once JS runs: without JS, every slide stays reachable.
      const hidden = ctx.hydrated.value && !active
      return h(props.tag, {
        'class': classes,
        'role': 'group',
        'aria-roledescription': o.i18n.slide,
        'aria-label': format(o.i18n.slideLabel, i + 1, total),
        'inert': hidden || undefined,
      }, content)
    }
  },
})
