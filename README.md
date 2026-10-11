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
| `type` | `'slide'` | `'slide'`, `'loop'` (endlos: nach der Hydration werden an beiden Enden Slides geklont) oder `'fade'` |
| `rewind` | `false` | am Ende zum Anfang springen |
| `perPage` / `perMove` | `1` / `perPage` | Slides pro Seite bzw. pro Schritt |
| `focus` | – | `'center'` zentriert die aktive Slide; eine Zahl setzt sie n Slides vom linken Rand |
| `fixedWidth` | – | feste Slide-Breite (CSS-Länge), `perPage` wird dann ignoriert |
| `autoWidth` | `false` | Breite aus dem Inhalt der Slide, z. B. für Tags |
| `gap`, `padding` | `0` | CSS-Längen; `padding` auch als `{ left, right }` für einen Blick auf die Nachbar-Slides |
| `height` / `fixedHeight`, `heightRatio` | – | feste Höhe oder Höhe relativ zur Slider-Breite (reserviert den Platz, also kein CLS) |
| `start` | `0` | Start-Slide |
| `arrows`, `pagination` | `true` | Steuerelemente |
| `arrowPath` | – | eigener SVG-Pfad wie bei Splide (40×40, zeigt nach rechts); alternativ die Slots `#arrow-prev` / `#arrow-next` |
| `paginationKeyboard` | `true` | Pagination als ARIA-Tabliste: ein Tab-Stopp, Pfeiltasten, Pos1/Ende |
| `autoplay`, `interval` | `false`, `5000` | mit Pause-Button; startet nie bei „Bewegung reduzieren“ |
| `pauseOnHover`, `pauseOnFocus` | `true` | |
| `drag` | `true` | Ziehen mit der Maus; `'free'` ohne Einrasten. Wischen per Touch ist natives Scrollen |
| `snap` | `false` | bei `drag: 'free'` nach dem Ziehen trotzdem einrasten |
| `wheel`, `wheelMinThreshold`, `wheelSleep` | `false`, `0`, `500` | mit dem Mausrad blättern |
| `releaseWheel` | `true` | am ersten/letzten Slide scrollt das Mausrad wieder die Seite (anders als Splide-Standard, damit niemand festhängt) |
| `speed` | `400` | Dauer der Fade-Überblendung in ms |
| `keyboard` | `true` | Pfeiltasten, wenn der Fokus im Slider ist |
| `isNavigation` | `false` | Thumbnail-Navigation, siehe `sync` |
| `breakpoints`, `mediaQuery` | –, `'max'` | wie bei Splide, z. B. `{ 640: { perPage: 1, focus: 'center' } }` |
| `i18n` | Englisch | Labels, z. B. `{ prev: 'Vorherige Folie', slideX: 'Folie %s von %s', select: 'Folie zum Anzeigen auswählen' }` |

**Props:** `options`, `label` (oder `aria-labelledby`), `sync`, `tag`.
**Slots:** Standard-Slot mit `<SliderSlide>`, `#arrow-prev`, `#arrow-next`.
**Events:** `move(index, prev)`, `moved(index)`, `active(index)`, `inactive(index)`, `visible(index)`, `hidden(index)`, `click(index, event)`, `mounted(api)`, `autoplay:play`, `autoplay:pause`.
**API** (per Template-Ref oder `mounted`): `go(index | '>' | '<')`, `play()`, `pause()`, `index`, `length`.

## Barrierefreiheit

- Der Container ist eine `region` mit `aria-roledescription="carousel"` und Label. Jede Slide ist eine `group` mit dem Label „Folie x von n“.
- Die Reihenfolge entspricht dem APG: Erst kommt der Autoplay-Button, dann Zurück/Weiter, danach die Slides und die Pagination.
- Nicht sichtbare Slides sind nach der Hydration `inert`, damit Tab und Screenreader nicht in unsichtbaren Inhalt springen.
- Eine Live-Region kündigt Wechsel an, die die Nutzerin oder der Nutzer selbst auslöst. Während Autoplay läuft, bleibt sie stumm.
- Steuerelemente sind mindestens 44 × 44 px groß, haben einen sichtbaren Fokus und unterstützen `forced-colors`. Bei `prefers-reduced-motion` gibt es keine Animation und kein Autoplay.
- Deaktivierte Pfeile nutzen `aria-disabled` statt `disabled`, damit der Fokus nicht verloren geht.
- Die Pagination ist eine Tabliste nach dem APG-Tabs-Muster: Nur der aktive Punkt ist per Tab erreichbar, Pfeiltasten, Pos1 und Ende wechseln, `aria-controls` zeigt auf die Slides der Seite.
- Die Thumbnail-Leiste hat ebenfalls nur einen Tab-Stopp; mit den Pfeiltasten, Pos1 und Ende wandert der Fokus, Enter wählt aus.
- Geklonte Slides (`loop`) sind `aria-hidden` und `inert`, Screenreader hören jede Slide also genau einmal.
- Das Mausrad gibt die Seite an den Enden wieder frei, niemand bleibt im Slider hängen.

## Vergleich mit Splide

Die Werte stammen aus dem Playground, der dieselbe Seite (Hero mit Autoplay, Produkte, Galerie mit Thumbnails, zentriertes Endlos-Karussell, feste Breite, Tags) einmal mit diesem Slider und einmal mit Splide baut. Gemessen wurde mit Lighthouse 13 am Produktions-Build, Median aus 3 Läufen:

| | dieser Slider (mobil) | Splide (mobil) | dieser Slider (Desktop) | Splide (Desktop) |
|---|---|---|---|---|
| Performance | 99 | 87 | 100 | 100 |
| Accessibility | 100 | 99 | 100 | 96 |
| LCP | 1,75 s | 2,11 s | 0,47 s | 0,53 s |
| TBT | 10 ms | 56 ms | 0 ms | 0 ms |
| CLS | 0 | 0,233 | 0 | 0 |

| | dieser Slider | Splide |
|---|---|---|
| JS (gzip) | ~7 KB | ~15 KB |
| CSS (gzip) | ~1,3 KB | ~1,3 KB |
| axe-Verstöße | 0 | 33 (`aria-allowed-role`, `target-size`) |

Selbst messen: `npm run build:playground`, `node playground/.output/server/index.mjs`, dann `npm run lighthouse`. Nicht gegen `npm run dev` messen, der Dev-Server liefert alles unkomprimiert und einzeln aus.

## Entwicklung

```bash
npm install
npm run dev            # Playground auf http://localhost:3000 (generiert vorher die Nuxt-Typen)
npm run build:playground && npm run test:e2e   # Playwright + axe, Desktop und Mobil
```

## Bekannte Grenzen

- Bei `type: 'loop'` entstehen die Klone erst nach der Hydration; davor beginnt der Slider ganz normal bei Slide 1.
- Ein schnelles Wischen per Touch kann wie beim nativen Scrollen mehrere Slides weit gehen.
- Noch nicht umgesetzt: RTL, vertikale Slider, `autoHeight`, AutoScroll-, Grid- und Video-Erweiterung.
