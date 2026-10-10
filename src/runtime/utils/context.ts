import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { ResolvedOptions } from './options'

export interface SliderContext {
  id: string
  options: ComputedRef<ResolvedOptions>
  /** Number of slides that are visible on the widest layout (eager image loading). */
  eagerCount: ComputedRef<number>
  total: ComputedRef<number>
  /** First visible slide. */
  index: Ref<number>
  /** Selected slide of a navigation (thumbnail) slider. */
  selected: Ref<number>
  /** False on the server and until mounted: before that, nothing is hidden from assistive tech. */
  hydrated: Ref<boolean>
  select: (index: number) => void
}

export const sliderKey: InjectionKey<SliderContext> = Symbol('slider')

/**
 * Thumbnail sync. Both sliders get the same `sync` id; one of them has
 * `isNavigation: true`. Lives only in the browser (registered in onMounted),
 * so nothing leaks between SSR requests. Works with lazy hydration: whichever
 * slider hydrates last picks up the current index of the other.
 */
export interface SyncMember {
  isNavigation: () => boolean
  /** Called on the main slider when a thumbnail is chosen. */
  go: (index: number) => void
  /** Called on navigation sliders when the main slider moved. */
  highlight: (index: number) => void
  currentIndex: () => number
}

const groups = new Map<string, Set<SyncMember>>()

export function joinSync(id: string, member: SyncMember) {
  let group = groups.get(id)
  if (!group) groups.set(id, group = new Set())
  group.add(member)

  const main = [...group].find(m => !m.isNavigation() && m !== member)
  if (member.isNavigation() && main) member.highlight(main.currentIndex())
  if (!member.isNavigation()) {
    for (const m of group) if (m.isNavigation()) m.highlight(member.currentIndex())
  }

  return {
    /** The main slider moved. */
    moved(index: number) {
      for (const m of group!) if (m !== member && m.isNavigation()) m.highlight(index)
    },
    /** A thumbnail was chosen. */
    chose(index: number) {
      for (const m of group!) if (m !== member && !m.isNavigation()) m.go(index)
    },
    leave() {
      group!.delete(member)
      if (!group!.size) groups.delete(id)
    },
  }
}
