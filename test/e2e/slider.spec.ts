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
  await expect(root.locator('.sl__slide:not(.is-clone)')).toHaveCount(6)
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
  await expect(root.locator('.sl__dot').nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(root.locator('.sl__sr')).toHaveText('Folie 2 von 6')
  // Hidden slides are inert, the visible one is not.
  await expect(root.locator('.sl__slide:not(.is-clone)').nth(1)).not.toHaveAttribute('inert', /.*/)
  await expect(root.locator('.sl__slide:not(.is-clone)').nth(0)).toHaveAttribute('inert', /.*/)

  await root.locator('.sl__dot').nth(4).click()
  await expect(root.locator('.sl__slide:not(.is-clone)').nth(4)).toHaveClass(/is-active/)
  // Loop: next from the last slide wraps to the first.
  await root.locator('.sl__dot').nth(5).click()
  await root.locator('.sl__arrow--next').click()
  await expect(root.locator('.sl__dot').nth(0)).toHaveAttribute('aria-selected', 'true')
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
  await expect(root.locator('.sl__dot').nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(root.locator('.sl__dot').nth(0)).toHaveAttribute('aria-selected', 'true')
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
  await expect(root.locator('.sl__dot').nth(1)).toHaveAttribute('aria-selected', 'true', { timeout: 9000 })
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
  await expect(root.locator('.sl__dot').nth(1)).toHaveAttribute('aria-selected', 'true')
})

test('thumbnail navigation follows the selection, like Splide', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'all 6 thumbnails fit on desktop')
  await page.goto('/')
  const thumbs = page.locator('.sl--nav')
  await thumbs.scrollIntoViewIfNeeded()
  await expect(thumbs).toHaveClass(/is-ready/)
  const track = thumbs.locator('.sl__track')
  const visible = await thumbs.locator('.sl__slide').evaluateAll(els => els.filter(el => el.getBoundingClientRect().right <= el.parentElement!.getBoundingClientRect().right + 1).length)
  // Choose the last fully visible thumbnail: the strip must move on.
  await thumbs.locator('.sl__thumb').nth(visible - 1).click()
  await expect.poll(() => track.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
  await expect(thumbs.locator('.sl__thumb').nth(visible - 1)).toBeInViewport()
})

test('mobile: no horizontal page overflow and links in slides stay tappable', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'mobile only')
  await page.goto('/')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  const products = page.locator('section.sl').nth(1)
  await products.scrollIntoViewIfNeeded()
  await expect(products).toHaveClass(/is-ready/)
  await products.locator('.sl__slide.is-active a').first().tap()
  await expect(page).toHaveURL(/#produkt-1$/)
})

test('thumbnail navigation also scrolls back when going backwards', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'all 6 thumbnails fit on desktop')
  await page.goto('/')
  const thumbs = page.locator('.sl--nav')
  await thumbs.scrollIntoViewIfNeeded()
  await expect(thumbs).toHaveClass(/is-ready/)
  const track = thumbs.locator('.sl__track')
  await thumbs.locator('.sl__thumb').nth(5).click()
  await expect.poll(() => track.evaluate(el => el.scrollWidth - el.clientWidth - el.scrollLeft)).toBeLessThan(2)
  const atEnd = await track.evaluate(el => el.scrollLeft)
  // Slide 6 → slide 3: the strip must move back so slide 2 becomes visible again.
  await thumbs.locator('.sl__thumb').nth(2).click()
  await expect.poll(() => track.evaluate(el => el.scrollLeft)).toBeLessThan(atEnd - 10)
  await expect(thumbs.locator('.sl__thumb').nth(1)).toBeInViewport({ ratio: 0.9 })
  await thumbs.locator('.sl__thumb').nth(1).click()
  await expect.poll(() => track.evaluate(el => el.scrollLeft)).toBeLessThan(2)
})

// ---- focus: 'center', loop, fixed/auto width, tabs, wheel ------------------

const section = (page: import('@playwright/test').Page, heading: string) =>
  page.locator(`section.sl[aria-labelledby="${heading}"]`)

const centerOffset = (root: import('@playwright/test').Locator) => root.evaluate((r) => {
  const t = r.querySelector('.sl__track')!.getBoundingClientRect()
  const a = r.querySelector('.sl__slide.is-active')!.getBoundingClientRect()
  return Math.abs(a.left + a.width / 2 - (t.left + t.width / 2))
})

test('focus center + endless loop: active slide centered, wraps both ways', async ({ page }, info) => {
  await page.goto('/')
  const root = section(page, 'center')
  await root.scrollIntoViewIfNeeded()
  await expect(root).toHaveClass(/is-ready/)
  const step = info.project.name === 'mobile' ? 1 : 3
  const active = root.locator('.sl__slide.is-active')
  await expect(active).toHaveAttribute('aria-label', '1 von 8')
  expect(await centerOffset(root)).toBeLessThan(2)

  // Clones exist on both sides, are hidden from assistive tech and not focusable.
  const clones = root.locator('.sl__slide.is-clone')
  expect(await clones.count()).toBeGreaterThan(0)
  await expect(clones.first()).toHaveAttribute('aria-hidden', 'true')
  await expect(clones.first()).toHaveAttribute('inert', /.*/)

  await root.locator('.sl__arrow--prev').click()
  await expect(active).toHaveAttribute('aria-label', `${8 - step + 1} von 8`)
  await expect.poll(() => centerOffset(root)).toBeLessThan(2)
  // After settling on a clone the track jumps back to the real slide.
  await expect.poll(() => root.locator('.sl__slide.is-active').evaluate(el => !el.classList.contains('is-clone'))).toBe(true)

  for (let i = 0; i < Math.ceil(8 / step) + 1; i++) {
    await root.locator('.sl__arrow--next').click()
    await page.waitForTimeout(500)
  }
  await expect.poll(() => centerOffset(root)).toBeLessThan(2)
  // The real active slide is the one in view, not a copy.
  await expect(root.locator('.sl__slide.is-visible.is-active')).toHaveCount(1)
})

test('pagination is a tab list with one tab stop and arrow-key navigation', async ({ page }) => {
  await page.goto('/')
  const root = section(page, 'center')
  await root.scrollIntoViewIfNeeded()
  await expect(root).toHaveClass(/is-ready/)
  const list = root.locator('.sl__pagination')
  await expect(list).toHaveAttribute('role', 'tablist')
  await expect(list).toHaveAttribute('aria-label', 'Folie zum Anzeigen auswählen')
  const tabs = list.locator('[role="tab"]')
  await expect(list.locator('[role="tab"]:not([tabindex="-1"])')).toHaveCount(1)
  await tabs.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.nth(1)).toBeFocused()
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(tabs.last()).toBeFocused()
  await expect(tabs.last()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowRight') // wraps
  await expect(tabs.first()).toBeFocused()
  await page.keyboard.press('ArrowLeft') // wraps back
  await expect(tabs.last()).toBeFocused()
  await page.keyboard.press('Home')
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
  // aria-controls points at the slides that page shows.
  const ids = (await tabs.first().getAttribute('aria-controls'))!.split(' ')
  for (const id of ids) await expect(page.locator(`#${id}`)).toHaveCount(1)
})

test('arrowPath renders a custom 40×40 arrow, mirrored for "previous"', async ({ page }) => {
  await page.goto('/')
  const root = section(page, 'center')
  await expect(root.locator('.sl__arrow--next svg')).toHaveAttribute('viewBox', '0 0 40 40')
  await expect(root.locator('.sl__arrow--prev svg')).toHaveAttribute('style', /scaleX\(-1\)/)
})

test('fixedWidth: pagination and arrows end where the track ends', async ({ page }) => {
  await page.goto('/')
  const root = section(page, 'fixed')
  await root.scrollIntoViewIfNeeded()
  await expect(root).toHaveClass(/is-ready/)
  await root.locator('.sl__dot').last().click()
  const track = root.locator('.sl__track')
  await expect.poll(() => track.evaluate(t => t.scrollWidth - t.clientWidth - t.scrollLeft)).toBeLessThan(2)
  await expect(root.locator('.sl__arrow--next')).toHaveAttribute('aria-disabled', 'true')
  // The last slide is fully visible and reachable.
  await expect(root.locator('.sl__slide').last()).toHaveClass(/is-visible/)
  await expect(root.locator('.sl__slide').last()).not.toHaveAttribute('inert', /.*/)
})

test('mouse wheel moves the slider and releases the page at the ends', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'no mouse wheel on touch devices')
  await page.goto('/')
  const root = section(page, 'fixed')
  await root.scrollIntoViewIfNeeded()
  await expect(root).toHaveClass(/is-ready/)
  const box = (await root.boundingBox())!
  await page.mouse.move(box.x + 100, box.y + 100)
  await page.mouse.wheel(0, 120)
  await expect(root.locator('.sl__slide.is-active')).toHaveAttribute('aria-label', '2 von 8')
  await page.waitForTimeout(600) // wheelSleep
  await page.mouse.wheel(0, -120)
  await expect(root.locator('.sl__slide.is-active')).toHaveAttribute('aria-label', '1 von 8')
  await page.waitForTimeout(600)
  const y = await page.evaluate(() => scrollY)
  await page.mouse.wheel(0, -200) // at the start: the page scrolls instead
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(y)
})

test('autoWidth + drag free: no snapping after a mouse drag', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'touch uses native scrolling')
  await page.goto('/')
  const root = section(page, 'tags')
  await root.scrollIntoViewIfNeeded()
  await expect(root).toHaveClass(/is-ready/)
  const track = root.locator('.sl__track')
  const box = (await track.boundingBox())!
  await page.mouse.move(box.x + 300, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 263, box.y + box.height / 2, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  const left = await track.evaluate(t => t.scrollLeft)
  const offsets = await root.locator('.sl__slide').evaluateAll(els => els.map(e => (e as HTMLElement).offsetLeft))
  expect(left).toBeGreaterThan(20)
  // Not snapped: the scroll position is not at a slide start.
  expect(offsets.some(o => Math.abs(o - left) < 2)).toBe(false)
})

test('thumbnails: one tab stop, arrow keys move between them', async ({ page }) => {
  await page.goto('/')
  const thumbs = page.locator('.sl--nav')
  await thumbs.scrollIntoViewIfNeeded()
  await expect(thumbs).toHaveClass(/is-ready/)
  const buttons = thumbs.locator('.sl__thumb')
  await expect(thumbs.locator('.sl__thumb[tabindex="0"]')).toHaveCount(1)
  await buttons.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(buttons.nth(1)).toBeFocused()
  await page.keyboard.press('End')
  await expect(buttons.last()).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('section.sl').nth(2).locator('.sl__slide.is-active')).toHaveAttribute('aria-label', '6 von 6')
})

test('responsive: center slider shows 3 per view on desktop, 1 with peek on mobile', async ({ page }, info) => {
  await page.goto('/')
  const root = section(page, 'center')
  await root.scrollIntoViewIfNeeded()
  await expect(root).toHaveClass(/is-ready/)
  const mobile = info.project.name === 'mobile'
  await expect(root.locator('.sl__slide.is-visible')).toHaveCount(mobile ? 1 : 2) // slide 8 left of 1 is a clone
  await expect(root.locator('.sl__page:visible')).toHaveCount(mobile ? 8 : 3)
  // Mobile peek: neighbours are partly visible on both sides.
  if (mobile) {
    const peek = await root.evaluate((r) => {
      const t = r.querySelector('.sl__track')!.getBoundingClientRect()
      const a = r.querySelector('.sl__slide.is-active')!.getBoundingClientRect()
      return [a.left - t.left, t.right - a.right]
    })
    expect(peek[0]).toBeGreaterThan(20)
    expect(peek[1]).toBeGreaterThan(20)
  }
})

test('mobile: swiping the endless slider wraps around', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'mobile', 'touch only')
  await page.goto('/')
  const root = section(page, 'center')
  await root.scrollIntoViewIfNeeded()
  await expect(root).toHaveClass(/is-ready/)
  const cdp = await context.newCDPSession(page)
  const box = (await root.locator('.sl__track').boundingBox())!
  const y = box.y + box.height / 2
  const swipe = async (from: number, to: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] })
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from + (to - from) * i / 10, y }] })
      await page.waitForTimeout(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  const active = root.locator('.sl__slide.is-active')
  // Short, slow swipes move one slide (a fast fling may skip several, as natively).
  await swipe(box.x + box.width * 0.4, box.x + box.width * 0.75) // backwards from slide 1
  await expect(active).toHaveAttribute('aria-label', '8 von 8')
  await expect.poll(() => centerOffset(root)).toBeLessThan(2)
  await swipe(box.x + box.width * 0.75, box.x + box.width * 0.4) // forwards again
  await expect(active).toHaveAttribute('aria-label', '1 von 8')
})

test('whole page: no layout shift while scrolling through all sliders', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__cls = 0
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto('/')
  for (const id of ['products', 'gallery', 'center', 'fixed', 'tags']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
  }
  expect(await page.evaluate(() => (window as any).__cls)).toBeLessThan(0.01)
})
