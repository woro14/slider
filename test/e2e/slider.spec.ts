import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const hero = '[data-sl]:first-of-type'

test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => {
    if (/hydration|mismatch/i.test(msg.text())) throw new Error(`Hydration warning: ${msg.text()}`)
  })
})

test('server HTML is complete: slides, controls and labels without JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  await page.goto('/')
  const root = page.locator('section.sl').first()
  await expect(root).toHaveAttribute('role', 'region')
  await expect(root).toHaveAttribute('aria-roledescription', 'Karussell')
  await expect(root.locator('.sl__slide')).toHaveCount(6)
  await expect(root.locator('img').first()).toHaveAttribute('fetchpriority', 'high')
  await expect(root.locator('img').nth(1)).toHaveAttribute('loading', 'lazy')
  // Without JS the track still scrolls natively.
  const scrolled = await root.locator('.sl__track').evaluate((el) => {
    el.scrollLeft = el.clientWidth
    return el.scrollLeft > 0
  })
  expect(scrolled).toBe(true)
  await ctx.close()
})

test('no accessibility violations (axe, WCAG 2.2 AA)', async ({ page }) => {
  await page.goto('/')
  await page.locator('#gallery').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  expect(results.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(', ')}`)).toEqual([])
})

test('no layout shift when the page hydrates', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('#products').scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  const cls = await page.evaluate(() => new Promise<number>((resolve) => {
    let sum = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as any[]) if (!e.hadRecentInput) sum += e.value
    }).observe({ type: 'layout-shift', buffered: true })
    setTimeout(() => resolve(sum), 300)
  }))
  expect(cls).toBeLessThan(0.01)
})

test('arrows, pagination and live region', async ({ page }) => {
  await page.goto('/')
  const root = page.locator('section.sl').first()
  await expect(root).toHaveClass(/is-ready/)
  // Stop autoplay first so it does not interfere.
  await root.locator('.sl__toggle').click()
  await expect(root.locator('.sl__toggle')).toHaveAttribute('aria-label', 'Automatische Wiedergabe starten')

  await root.locator('.sl__arrow--next').click()
  await expect(root.locator('.sl__dot').nth(1)).toHaveAttribute('aria-current', 'true')
  await expect(root.locator('.sl__sr')).toHaveText('Folie 2 von 6')
  // Hidden slides are inert, the visible one is not.
  await expect(root.locator('.sl__slide').nth(1)).not.toHaveAttribute('inert', /.*/)
  await expect(root.locator('.sl__slide').nth(0)).toHaveAttribute('inert', /.*/)

  await root.locator('.sl__dot').nth(4).click()
  await expect(root.locator('.sl__slide').nth(4)).toHaveClass(/is-active/)
  // Loop: next from the last slide wraps to the first.
  await root.locator('.sl__dot').nth(5).click()
  await root.locator('.sl__arrow--next').click()
  await expect(root.locator('.sl__dot').nth(0)).toHaveAttribute('aria-current', 'true')
})

test('keyboard: arrow keys move the slider, rotation control comes first', async ({ page }) => {
  await page.goto('/')
  const root = page.locator('section.sl').first()
  await expect(root).toHaveClass(/is-ready/)
  await root.locator('.sl__toggle').focus()
  // Focus inside pauses autoplay (pauseOnFocus).
  await page.keyboard.press('Tab') // prev
  await page.keyboard.press('Tab') // next
  await expect(root.locator('.sl__arrow--next')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(root.locator('.sl__dot').nth(1)).toHaveAttribute('aria-current', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(root.locator('.sl__dot').nth(0)).toHaveAttribute('aria-current', 'true')
})

test('reduced motion: autoplay never starts by itself', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('/')
  const root = page.locator('section.sl').first()
  await expect(root).toHaveClass(/is-ready/)
  await expect(root).not.toHaveClass(/is-playing/)
  await ctx.close()
})

test('autoplay advances and the pause button stops it', async ({ page }) => {
  await page.goto('/')
  const root = page.locator('section.sl').first()
  await expect(root).toHaveClass(/is-playing/)
  await page.mouse.move(0, 0)
  await expect(root.locator('.sl__dot').nth(1)).toHaveAttribute('aria-current', 'true', { timeout: 9000 })
  await root.locator('.sl__toggle').click()
  await expect(root).not.toHaveClass(/is-playing/)
})

test('below-the-fold sliders hydrate only when visible', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const products = page.locator('section.sl').nth(1)
  await expect(products).not.toHaveClass(/is-ready/)
  await products.scrollIntoViewIfNeeded()
  await expect(products).toHaveClass(/is-ready/)
})

test('responsive: breakpoints change slides per page and pagination', async ({ page }, info) => {
  await page.goto('/')
  const products = page.locator('section.sl').nth(1)
  await products.scrollIntoViewIfNeeded()
  await expect(products).toHaveClass(/is-ready/)
  const visibleDots = await products.locator('.sl__page:visible').count()
  // 8 products: 4 per page (moving 4) → 2 pages, 1 per page (mobile) → 8 pages. Same as Splide.
  expect(visibleDots).toBe(info.project.name === 'mobile' ? 8 : 2)
})

test('thumbnails stay in sync with the main slider', async ({ page }) => {
  await page.goto('/')
  const main = page.locator('section.sl').nth(2)
  const thumbs = page.locator('.sl--nav')
  await thumbs.scrollIntoViewIfNeeded()
  await expect(main).toHaveClass(/is-ready/)
  await expect(thumbs).toHaveClass(/is-ready/)

  await thumbs.locator('.sl__thumb').nth(3).click()
  await expect(main.locator('.sl__slide').nth(3)).toHaveClass(/is-active/)
  await expect(thumbs.locator('.sl__thumb').nth(3)).toHaveAttribute('aria-current', 'true')

  await main.locator('.sl__arrow--next').click()
  await expect(thumbs.locator('.sl__thumb').nth(4)).toHaveAttribute('aria-current', 'true')
})

test('mouse drag moves to the next slide', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'touch uses native scrolling')
  await page.goto('/')
  const root = page.locator('section.sl').first()
  await expect(root).toHaveClass(/is-ready/)
  await root.locator('.sl__toggle').click()
  const box = (await root.locator('.sl__track').boundingBox())!
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(root.locator('.sl__dot').nth(1)).toHaveAttribute('aria-current', 'true')
})
