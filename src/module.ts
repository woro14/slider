import { defineNuxtModule, createResolver, addComponent } from '@nuxt/kit'

export interface ModuleOptions {
  /**
   * Prefix for the auto-imported components.
   * Default `Slider` gives `<Slider>` and `<SliderSlide>`
   * (and `<LazySlider hydrate-on-visible>` for lazy hydration).
   */
  prefix: string
  /** Inject the default stylesheet. Disable to ship your own CSS. */
  css: boolean
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-a11y-slider',
    configKey: 'slider',
    compatibility: { nuxt: '>=3.16.0' },
  },
  defaults: {
    prefix: 'Slider',
    css: true,
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    if (options.css) {
      nuxt.options.css.push(resolver.resolve('./runtime/assets/slider.css'))
    }

    addComponent({
      name: options.prefix,
      filePath: resolver.resolve('./runtime/components/Slider'),
    })
    addComponent({
      name: `${options.prefix}Slide`,
      filePath: resolver.resolve('./runtime/components/SliderSlide'),
    })
  },
})
