<script setup lang="ts">
import { Splide, SplideSlide } from '@splidejs/vue-splide'
import '@splidejs/vue-splide/css'

const slides = Array.from({ length: 6 }, (_, i) => i + 1)
const products = Array.from({ length: 8 }, (_, i) => i + 1)
const main = ref()
const thumbs = ref()
onMounted(() => {
  if (main.value?.splide && thumbs.value?.splide) main.value.sync(thumbs.value.splide)
})
</script>

<template>
  <div>
    <h1>Gleiche Seite mit Splide</h1>
    <Splide aria-label="Aktuelle Angebote" :options="{ type: 'loop', heightRatio: 9 / 16, autoplay: true, interval: 6000, cover: false }">
      <SplideSlide v-for="n in slides" :key="n">
        <img
          class="cover"
          :src="`/img/slide-${n}.webp`"
          :srcset="`/img/slide-${n}-800.webp 800w, /img/slide-${n}.webp 1600w`"
          sizes="(max-width: 72rem) 100vw, 70rem"
          width="1600"
          height="900"
          :alt="`Angebot ${n}`"
        >
      </SplideSlide>
    </Splide>

    <div class="spacer">
      <p>Scrolle nach unten.</p>
    </div>

    <h2 id="products">Produkte</h2>
    <Splide
      aria-labelledby="products"
      :options="{ perPage: 4, gap: '1rem', padding: { right: '3rem' }, breakpoints: { 1024: { perPage: 3 }, 640: { perPage: 1, padding: { right: '4rem' } } } }"
    >
      <SplideSlide v-for="n in products" :key="n">
        <article class="card">
          <img :src="`/img/slide-${n}-800.webp`" width="800" height="450" alt="" loading="lazy">
          <p><a :href="`#produkt-${n}`">Produkt {{ n }}</a></p>
        </article>
      </SplideSlide>
    </Splide>

    <h2 id="gallery">Galerie mit Thumbnails</h2>
    <Splide ref="main" aria-labelledby="gallery" :options="{ type: 'fade', heightRatio: 9 / 16, pagination: false }">
      <SplideSlide v-for="n in slides" :key="n">
        <img class="cover" :src="`/img/slide-${n}-800.webp`" width="800" height="450" :alt="`Galeriebild ${n}`" loading="lazy">
      </SplideSlide>
    </Splide>
    <Splide ref="thumbs" aria-label="Galerie-Vorschaubilder" :options="{ isNavigation: true, perPage: 6, gap: '.5rem', arrows: false, pagination: false, height: '4rem', fixedHeight: '4rem', breakpoints: { 640: { perPage: 4 } } }" style="margin-top: .5rem">
      <SplideSlide v-for="n in slides" :key="n">
        <img class="cover" :src="`/img/thumb-${n}.webp`" width="240" height="160" alt="" loading="lazy">
      </SplideSlide>
    </Splide>
  </div>
</template>
