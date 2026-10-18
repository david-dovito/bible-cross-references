import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useStringPreference } from '../../../shared/lib/preferences.ts';
import styles from './PassagePanel.module.css';

/**
 * The details panel's sections in the order each reader drags them into (David, 2026-10-18: "Each
 * user should be able to drag the order of these dropdowns in their browser session"). The order
 * is a preference in this browser (localStorage, as the sections' open or closed state is), so it
 * lasts between visits on this device and never leaves it.
 *
 * A grip on each section's band moves it: dragged with a mouse or a finger, or with the arrow keys
 * once focused. Sections a passage lacks (a chapter has no words) keep their place for the ones
 * that have them.
 */

const ORDER_KEY = 'panel:order';
/** Near the scroll area's edge, a drag scrolls it by this much per move. */
const EDGE_PX = 48;
const EDGE_SCROLL_PX = 14;

interface Sortable {
  readonly start: (id: string, event: PointerEvent<HTMLElement>) => void;
  readonly move: (id: string, by: -1 | 1) => void;
  readonly dragging: string | null;
}

const SortableContext = createContext<Sortable | null>(null);

/** Orders `ids` by the stored order; ids it has never seen keep their default neighbours. */
export function orderSections(ids: readonly string[], stored: readonly string[]): string[] {
  if (stored.length === 0) {
    return [...ids];
  }
  const rank = new Map<string, number>();
  let last = -1;
  for (const id of ids) {
    const at = stored.indexOf(id);
    // An id the stored order lacks sits just after the one before it by default.
    last = at === -1 ? last + 0.001 : at;
    rank.set(id, last);
  }
  return [...ids].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
}

/** The stored order after `shown` was rearranged: ids not shown keep their places. */
export function mergeOrder(shown: readonly string[], stored: readonly string[]): string[] {
  const hidden = stored.filter((id) => !shown.includes(id));
  return [...shown, ...hidden];
}

export function SortableSections({
  sections,
}: {
  readonly sections: readonly { readonly id: string; readonly node: ReactNode }[];
}) {
  const [storedText, store] = useStringPreference(ORDER_KEY, '');
  const stored = useMemo(() => storedText.split(',').filter((id) => id !== ''), [storedText]);
  const ids = sections.map((section) => section.id);
  const order = orderSections(ids, stored);
  const [drag, setDrag] = useState<{ id: string; order: string[] } | null>(null);
  const shown = drag?.order ?? order;
  const items = useRef(new Map<string, HTMLDivElement>());
  const save = (next: readonly string[]) => {
    store(mergeOrder(next, stored).join(','));
  };

  const sortable: Sortable = {
    dragging: drag?.id ?? null,
    move: (id, by) => {
      const next = [...order];
      const at = next.indexOf(id);
      const to = at + by;
      if (at === -1 || to < 0 || to >= next.length) {
        return;
      }
      next.splice(at, 1);
      next.splice(to, 0, id);
      save(next);
    },
    start: (id, event) => {
      event.preventDefault();
      const handle = event.currentTarget;
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        // A pointer the browser no longer tracks: the drag still follows the handle's events.
      }
      let current = [...order];
      setDrag({ id, order: current });
      const scroller = handle.closest(`.${styles.scroll ?? ''}`);
      const onMove = (move: globalThis.PointerEvent) => {
        if (scroller) {
          const box = scroller.getBoundingClientRect();
          if (move.clientY < box.top + EDGE_PX) scroller.scrollBy(0, -EDGE_SCROLL_PX);
          else if (move.clientY > box.bottom - EDGE_PX) scroller.scrollBy(0, EDGE_SCROLL_PX);
        }
        // The dragged section goes before the first other section whose middle is below the
        // pointer, or last if none is.
        const others = current.filter((other) => other !== id);
        let index = others.length;
        for (let at = 0; at < others.length; at += 1) {
          const box = items.current.get(others[at] ?? '')?.getBoundingClientRect();
          if (box && move.clientY < box.top + box.height / 2) {
            index = at;
            break;
          }
        }
        const next = [...others.slice(0, index), id, ...others.slice(index)];
        if (next.join() !== current.join()) {
          current = next;
          setDrag({ id, order: next });
        }
      };
      const onEnd = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
        setDrag(null);
        save(current);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    },
  };

  const byId = new Map(sections.map((section) => [section.id, section.node]));
  return (
    <SortableContext.Provider value={sortable}>
      {shown.map((id) => (
        <div
          key={id}
          ref={(element) => {
            if (element) items.current.set(id, element);
            else items.current.delete(id);
          }}
          className={styles.sortable}
          data-dragging={drag?.id === id ? 'true' : undefined}
        >
          {byId.get(id)}
        </div>
      ))}
    </SortableContext.Provider>
  );
}

/** The grip a section's band carries while it is among sortable sections. */
export function SectionGrip({ id, title }: { readonly id: string; readonly title: string }) {
  const sortable = useContext(SortableContext);
  if (!sortable) {
    return null;
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      sortable.move(id, event.key === 'ArrowUp' ? -1 : 1);
      // The section moves, and the grip with it; focus follows it to its new place.
      const grip = event.currentTarget;
      requestAnimationFrame(() => {
        grip.focus();
      });
    }
  };
  return (
    <button
      type="button"
      className={styles.grip}
      aria-label={`Move ${title}: drag, or use the up and down arrow keys`}
      title="Drag to reorder"
      onPointerDown={(event) => {
        sortable.start(id, event);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
