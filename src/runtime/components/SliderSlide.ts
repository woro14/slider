import { computed, defineComponent, h, inject } from 'vue'
import { sliderKey } from '../utils/context'
import { format } from '../utils/options'

export default defineComponent({
  name: 'SliderSlide',
  props: {
    /** Set by the parent `<Slider>`; you never pass it yourself. */
    index: { type: Number, default: 0 },
    /** Set by the parent for the copies `type: 'loop'` adds on both ends. */
    clone: { type: Boolean, default: false },
    tag: { type: String, default: 'div' },
  },
  setup(props, { slots }) {
    const ctx = inject(sliderKey, null)
    if (!ctx) throw new Error('<SliderSlide> must be used inside <Slider>')

    const state = computed(() => {
      const o = ctx.options.value
      const i = props.index
      const nav = o.isNavigation
      const active = nav ? ctx.selected.value === i : ctx.index.value === i
      // Server and first client render: what the first page shows. Afterwards
      // measured from the real layout (works for center, peek, fixed widths).
      const visible = ctx.visible.value
        ? !props.clone && !!ctx.visible.value[i]
        : o.type === 'fade' ? i === ctx.index.value : i >= ctx.index.value && i < ctx.index.value + o.perPage
      return { o, i, total: ctx.total.value, nav, active, visible }
    })

    return () => {
      const { o, i, total, nav, active, visible } = state.value
      const clone = props.clone
      // Above-the-fold images: the first slide is the likely LCP element.
      const eager = !nav && !clone && i >= o.start && i < o.start + ctx.eagerCount.value
      const imgAttrs = {
        loading: eager ? 'eager' : 'lazy',
        fetchpriority: eager && i === o.start ? 'high' : undefined,
        decoding: 'async',
        draggable: 'false',
      } as const
      const content = slots.default?.({ index: i, active, imgAttrs })
      const classes = ['sl__slide', { 'is-active': active && !clone, 'is-visible': visible, 'is-clone': clone }]

      if (nav) {
        const roving = ctx.hydrated.value
        return h(props.tag, { class: classes }, [
          h('button', {
            'type': 'button',
            'class': 'sl__thumb',
            'aria-label': format(o.i18n.goTo, i + 1),
            'aria-current': active ? 'true' : undefined,
            // One tab stop for the whole strip once JS runs; arrow keys move between thumbnails.
            'tabindex': roving ? (active ? 0 : -1) : undefined,
            'onClick': () => ctx.select(i),
          }, content),
        ])
      }

      if (clone) {
        return h(props.tag, { 'class': classes, 'aria-hidden': 'true', 'inert': true }, content)
      }

      // Hidden slides are removed from tab order and the accessibility tree,
      // but only once JS runs: without JS, every slide stays reachable.
      const hidden = ctx.hydrated.value && !visible
      return h(props.tag, {
        'class': classes,
        'id': `${ctx.id}-slide-${i + 1}`,
        'role': 'group',
        'aria-roledescription': o.i18n.slide,
        'aria-label': format(o.i18n.slideLabel, i + 1, total),
        'inert': hidden || undefined,
        'onClick': (e: MouseEvent) => ctx.click(i, e),
      }, content)
    }
  },
})
