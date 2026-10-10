export default defineNuxtConfig({
  modules: ['../src/module'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  nitro: { compressPublicAssets: true },
  // Pre-bundle Splide up front: discovered lazily on the /splide route, Vite
  // re-optimizes mid-session and the page ends up with two copies of Vue.
  vite: { optimizeDeps: { include: ['@splidejs/vue-splide', '@splidejs/splide'] } },
  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      title: 'nuxt-a11y-slider Playground',
      meta: [{ name: 'description', content: 'Barrierefreier, SSR-fähiger Slider für Nuxt 4' }],
    },
  },
})
