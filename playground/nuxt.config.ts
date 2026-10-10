export default defineNuxtConfig({
  modules: ['../src/module'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  nitro: { compressPublicAssets: true },
  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      title: 'nuxt-a11y-slider Playground',
      meta: [{ name: 'description', content: 'Barrierefreier, SSR-fähiger Slider für Nuxt 4' }],
    },
  },
})
