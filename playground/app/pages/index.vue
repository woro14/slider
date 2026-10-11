<script setup lang="ts">
const slides = Array.from({ length: 6 }, (_, i) => i + 1)
const products = Array.from({ length: 8 }, (_, i) => i + 1)
const de = {
  carousel: 'Karussell', slide: 'Folie', slideLabel: '%s von %s',
  prev: 'Vorherige Folie', next: 'Nächste Folie', first: 'Zur letzten Folie', last: 'Zur ersten Folie',
  goTo: 'Gehe zu Folie %s', pageX: 'Gehe zu Seite %s', play: 'Automatische Wiedergabe starten',
  pause: 'Automatische Wiedergabe anhalten', slideX: 'Folie %s von %s',
  select: 'Folie zum Anzeigen auswählen',
}
const tags = ['Neu', 'Sale', 'Bestseller', 'Damen', 'Herren', 'Kinder', 'Sport', 'Outdoor', 'Accessoires', 'Schuhe', 'Taschen', 'Nachhaltig']
// Splide's own arrow path (40×40, pointing right).
const arrowPath = 'm15.5 0.932-4.3 4.38 14.5 14.6-14.5 14.5 4.3 4.4 14.6-14.6 4.4-4.3-4.4-4.4-14.6-14.6z'
</script>

<template>
  <div>
    <h1>Barrierefreier Slider für Nuxt 4</h1>

    <!-- Above the fold: hydrates right away (autoplay), the LCP image is preloaded with high priority. -->
    <Slider
      label="Aktuelle Angebote"
      :options="{ type: 'loop', heightRatio: 9 / 16, autoplay: true, interval: 6000, i18n: de }"
    >
      <SliderSlide v-for="n in slides" :key="n" v-slot="{ imgAttrs }">
        <img
          v-bind="imgAttrs"
          class="cover"
          :src="`/img/slide-${n}.webp`"
          :srcset="`/img/slide-${n}-800.webp 800w, /img/slide-${n}.webp 1600w`"
          sizes="(max-width: 72rem) 100vw, 70rem"
          width="1600"
          height="900"
          :alt="`Angebot ${n}`"
        >
      </SliderSlide>
    </Slider>

    <div class="spacer">
      <p>Scrolle nach unten: Die folgenden Slider laden ihr JavaScript erst, wenn sie sichtbar werden.</p>
    </div>

    <h2 id="products">Produkte</h2>
    <LazySlider
      hydrate-on-visible
      aria-labelledby="products"
      :options="{
        perPage: 4, gap: '1rem', padding: { right: '3rem' }, i18n: de,
        breakpoints: { 1024: { perPage: 3 }, 640: { perPage: 1, padding: { right: '4rem' } } },
      }"
    >
      <SliderSlide v-for="n in products" :key="n" v-slot="{ imgAttrs }">
        <article class="card">
          <img v-bind="imgAttrs" :src="`/img/slide-${n}-800.webp`" width="800" height="450" alt="">
          <p><a :href="`#produkt-${n}`">Produkt {{ n }}</a></p>
        </article>
      </SliderSlide>
    </LazySlider>

    <h2 id="gallery">Galerie mit Thumbnails</h2>
    <LazySlider
      hydrate-on-visible
      sync="gallery"
      aria-labelledby="gallery"
      :options="{ type: 'fade', heightRatio: 9 / 16, pagination: false, i18n: de }"
    >
      <SliderSlide v-for="n in slides" :key="n" v-slot="{ imgAttrs }">
        <img v-bind="imgAttrs" class="cover" :src="`/img/slide-${n}-800.webp`" width="800" height="450" :alt="`Galeriebild ${n}`">
      </SliderSlide>
    </LazySlider>
    <LazySlider
      hydrate-on-visible
      sync="gallery"
      label="Galerie-Vorschaubilder"
      :options="{ isNavigation: true, perPage: 6, gap: '.5rem', arrows: false, height: '4rem', i18n: de,
                  breakpoints: { 640: { perPage: 4 } } }"
      style="margin-top: .5rem"
    >
      <SliderSlide v-for="n in slides" :key="n">
        <img :src="`/img/thumb-${n}.webp`" width="240" height="160" alt="" loading="lazy" decoding="async">
      </SliderSlide>
    </LazySlider>

    <h2 id="center">Endlos und zentriert</h2>
    <LazySlider
      hydrate-on-visible
      aria-labelledby="center"
      :options="{
        type: 'loop', focus: 'center', perPage: 3, gap: '1rem', heightRatio: 0.25, arrowPath, i18n: de,
        breakpoints: { 640: { perPage: 1, padding: '12%', heightRatio: 0.5 } },
      }"
    >
      <SliderSlide v-for="n in products" :key="n" v-slot="{ imgAttrs }">
        <img v-bind="imgAttrs" class="cover" :src="`/img/slide-${n}-800.webp`" width="800" height="450" :alt="`Motiv ${n}`">
      </SliderSlide>
    </LazySlider>

    <h2 id="fixed">Feste Breite, Mausrad</h2>
    <LazySlider
      hydrate-on-visible
      aria-labelledby="fixed"
      :options="{ fixedWidth: '14rem', gap: '1rem', wheel: true, i18n: de, breakpoints: { 640: { fixedWidth: '70%' } } }"
    >
      <SliderSlide v-for="n in products" :key="n" v-slot="{ imgAttrs }">
        <article class="card">
          <img v-bind="imgAttrs" :src="`/img/slide-${n}-800.webp`" width="800" height="450" alt="">
          <p><a :href="`#artikel-${n}`">Artikel {{ n }}</a></p>
        </article>
      </SliderSlide>
    </LazySlider>

    <h2 id="tags">Automatische Breite, freies Ziehen</h2>
    <LazySlider
      hydrate-on-visible
      aria-labelledby="tags"
      :options="{ autoWidth: true, gap: '.5rem', drag: 'free', pagination: false, arrows: false, i18n: de }"
    >
      <SliderSlide v-for="t in tags" :key="t">
        <a class="tag" :href="`#tag-${t}`">{{ t }}</a>
      </SliderSlide>
    </LazySlider>
  </div>
</template>
