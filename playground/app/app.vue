<template>
  <div class="page">
    <a class="skip" href="#main">Zum Inhalt springen</a>
    <header>
      <nav aria-label="Demos">
        <NuxtLink to="/">Slider</NuxtLink>
        <NuxtLink to="/splide">Splide-Vergleich</NuxtLink>
      </nav>
    </header>
    <main id="main">
      <NuxtPage />
    </main>
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font: 1rem/1.5 system-ui, sans-serif; color: #1b1b1b; background: #fff; }
.page { max-width: 72rem; margin: 0 auto; padding: 0 1rem 4rem; }
header nav { display: flex; gap: 1rem; padding: 1rem 0; }
header a { color: #0b4fd6; }
.skip { position: absolute; left: -999px; }
.skip:focus { left: 1rem; top: 1rem; background: #fff; padding: .5rem; z-index: 10; }
h1 { font-size: 1.75rem; margin: .5rem 0 1rem; }
h2 { font-size: 1.25rem; margin: 3rem 0 .75rem; }
img { display: block; max-width: 100%; height: auto; }
.cover { width: 100%; height: 100%; object-fit: cover; }
.spacer { min-height: 120vh; padding-top: 2rem; color: #444; }
.card { border: 1px solid #ddd; border-radius: .5rem; overflow: hidden; height: 100%; }
.card p { margin: 0; padding: .5rem .75rem; }
.card a { color: #0b4fd6; }
</style>
