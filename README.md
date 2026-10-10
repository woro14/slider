# nuxt-a11y-slider

Barrierefreier, SSR-fähiger Slider für **Vue 3 / Nuxt 4** mit einer API nach dem Vorbild von Splide.

- **PageSpeed-freundlich:** Das Layout entsteht komplett per CSS (Scroll-Snap + Custom Properties) und wird fertig vom Server ausgeliefert. Dadurch gibt es keinen Layout-Shift (CLS 0), wenn das JavaScript später hydriert. Das JS ist rund 5 KB groß (gzip), Splide liegt bei rund 15 KB.
- **Lazy Hydration:** Mit Nuxts `hydrate-on-visible` lädt und startet das JS erst, wenn der Slider im Viewport ist.
- **Funktioniert ohne JS:** Die Slides sind ab dem ersten Byte HTML sicht- und scrollbar.
- **Barrierefrei:** Umgesetzt sind WCAG 2.2 AA und das [WAI-ARIA-Carousel-Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/), axe meldet 0 Verstöße.

## Installation

```bash
npm i nuxt-a11y-slider
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-a11y-slider'],
  // slider: { prefix: 'Slider', css: true },
})
```

## Verwendung

```vue
<!-- Oberhalb des sichtbaren Bereichs: sofort hydrieren, das erste Bild bekommt fetchpriority="high" -->
<Slider label="Aktuelle Angebote" :options="{ type: 'loop', heightRatio: 9 / 16, autoplay: true }">
  <SliderSlide v-for="item in items" :key="item.id" v-slot="{ imgAttrs }">
    <img v-bind="imgAttrs" :src="item.src" width="1600" height="900" :alt="item.alt">
  </SliderSlide>
</Slider>

<!-- Unterhalb: JS wird erst geladen, wenn der Slider sichtbar wird -->
<LazySlider hydrate-on-visible aria-labelledby="products-heading" :options="{ perPage: 4, gap: '1rem', breakpoints: { 640: { perPage: 1 } } }">
  <SliderSlide v-for="p in products" :key="p.id" v-slot="{ imgAttrs }">
    <img v-bind="imgAttrs" :src="p.image" width="800" height="450" alt="">
  </SliderSlide>
</LazySlider>
```

`imgAttrs` setzt `loading="eager"` für die Slides, die beim Laden sichtbar sind, und `fetchpriority="high"` für das erste Bild (LCP). Alle anderen Bilder bekommen `loading="lazy"`. Das funktioniert auch mit `<NuxtImg v-bind="imgAttrs">`.

Bei `hydrate-on-visible` zeigt der Slider bis zur Hydration schon das fertige HTML. Wer im Hero kein Autoplay braucht, kann auch dort `<LazySlider hydrate-on-interaction>` nehmen. Dann lädt das JS erst beim ersten Klick, Hover oder Fokus.

### Thumbnails (Sync)

Wie `splide.sync()`: Beide Slider bekommen dieselbe `sync`-ID, die Vorschau zusätzlich `isNavigation: true`. Die Synchronisierung funktioniert auch, wenn beide unterschiedlich spät hydriert werden.

```vue
<LazySlider hydrate-on-visible sync="gallery" label="Galerie" :options="{ type: 'fade', pagination: false }">…</LazySlider>
<LazySlider hydrate-on-visible sync="gallery" label="Vorschaubilder" :options="{ isNavigation: true, perPage: 6, gap: '.5rem', arrows: false }">…</LazySlider>
```

## Optionen

Die Namen entsprechen denen von Splide.

| Option | Standard | Beschreibung |
|---|---|---|
| `type` | `'slide'` | `'slide'`, `'loop'` (Pfeile und Autoplay springen am Ende zum Anfang) oder `'fade'` |
| `rewind` | `false` | am Ende zum Anfang springen |
| `perPage` / `perMove` | `1` / `perPage` | Slides pro Seite bzw. pro Schritt |
| `gap`, `padding` | `0` | CSS-Längen; `padding` auch als `{ left, right }` für einen Blick auf die Nachbar-Slides |
| `height`, `heightRatio` | – | feste Höhe oder Höhe relativ zur Slider-Breite (reserviert den Platz, also kein CLS) |
| `start` | `0` | Start-Slide |
| `arrows`, `pagination` | `true` | Steuerelemente |
| `autoplay`, `interval` | `false`, `5000` | mit Pause-Button; startet nie bei „Bewegung reduzieren“ |
| `pauseOnHover`, `pauseOnFocus` | `true` | |
| `drag` | `true` | Ziehen mit der Maus; Wischen per Touch ist natives Scrollen |
| `speed` | `400` | Dauer der Fade-Überblendung in ms |
| `keyboard` | `true` | Pfeiltasten, wenn der Fokus im Slider ist |
| `isNavigation` | `false` | Thumbnail-Navigation, siehe `sync` |
| `breakpoints`, `mediaQuery` | –, `'max'` | wie bei Splide, z. B. `{ 640: { perPage: 1 } }` |
| `i18n` | Englisch | Labels, z. B. `{ prev: 'Vorherige Folie', slideX: 'Folie %s von %s' }` |

**Props:** `options`, `label` (oder `aria-labelledby`), `sync`, `tag`.
**Events:** `move(index, prev)`, `moved(index)`, `mounted(api)`, `autoplay:play`, `autoplay:pause`.
**API** (per Template-Ref oder `mounted`): `go(index | '>' | '<')`, `play()`, `pause()`, `index`, `length`.

## Barrierefreiheit

- Der Container ist eine `region` mit `aria-roledescription="carousel"` und Label. Jede Slide ist eine `group` mit dem Label „Folie x von n“.
- Die Reihenfolge entspricht dem APG: Erst kommt der Autoplay-Button, dann Zurück/Weiter, danach die Slides und die Pagination.
- Nicht sichtbare Slides sind nach der Hydration `inert`, damit Tab und Screenreader nicht in unsichtbaren Inhalt springen.
- Eine Live-Region kündigt Wechsel an, die die Nutzerin oder der Nutzer selbst auslöst. Während Autoplay läuft, bleibt sie stumm.
- Steuerelemente sind mindestens 44 × 44 px groß, haben einen sichtbaren Fokus und unterstützen `forced-colors`. Bei `prefers-reduced-motion` gibt es keine Animation und kein Autoplay.
- Deaktivierte Pfeile nutzen `aria-disabled` statt `disabled`, damit der Fokus nicht verloren geht.

## Vergleich mit Splide

Die Werte stammen aus dem Playground, der dieselbe Seite einmal mit diesem Slider und einmal mit Splide baut. Gemessen wurde mit Lighthouse 13, mobil, als Median aus 3 Läufen:

| | dieser Slider | Splide |
|---|---|---|
| Performance | 99 | 99 |
| Accessibility | 100 | 99 |
| LCP | 1,7 s | 1,9 s |
| CLS | 0 | 0,012 |
| JS (gzip) | ~5 KB | ~15 KB |
| axe-Verstöße | 0 | 13 (`aria-allowed-role`, `target-size`) |

Selbst messen: `npm run build:playground`, den Server starten, dann `npm run lighthouse`.

## Entwicklung

```bash
npm install
npm run dev:prepare
npm run dev            # Playground auf http://localhost:3000
npm run build:playground && npm run test:e2e   # Playwright + axe, Desktop und Mobil
```

## Bekannte Grenzen

- `type: 'loop'` springt am Ende zum Anfang zurück, ohne geklonte Slides. Es gibt also kein endloses Weiterwischen per Touch.
- Noch nicht umgesetzt: RTL, vertikale Slider, AutoScroll-Erweiterung und Video.
