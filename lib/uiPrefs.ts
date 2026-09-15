/**
 * Small UI preferences that live outside the game document (AsyncStorage,
 * never part of AppData). Each hook returns the saved preference when one
 * exists and the caller's default until then.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/** Whether the Capture Dock's outcome-type grid is open. Written only when the coach toggles it. */
export const TYPES_EXPANDED_KEY = 'ctg:ui:typesExpanded';

/** Session cache so a remount (tab switch) shows the saved value at once: undefined = not read yet, null = nothing saved. */
let typesExpandedCache: boolean | null | undefined;
/** The one storage read per launch; every caller shares it. */
let typesExpandedRead: Promise<boolean | null> | undefined;

function parseFlag(raw: string | null): boolean | null {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

/**
 * Starts (once) the read that warms the cache and returns its promise. The
 * store calls it at launch, while the Splash is up, so the first CTG mount
 * renders the saved state straight away instead of painting the default and
 * snapping (on native the read is a bridge round-trip, not the same tick).
 */
export function primeTypesExpanded(): Promise<boolean | null> {
  if (!typesExpandedRead) {
    typesExpandedRead = AsyncStorage.getItem(TYPES_EXPANDED_KEY)
      .then((raw) => {
        // A toggle that happened while the read was in flight wins.
        if (typesExpandedCache === undefined) typesExpandedCache = parseFlag(raw);
        return typesExpandedCache;
      })
      .catch(() => null);
  }
  return typesExpandedRead;
}

/**
 * [open, setOpen, explicit] for the dock's outcome types. `defaultOpen`
 * applies until a preference exists (the screen passes one based on the
 * window height); `setOpen` persists the choice. `explicit` is true once
 * `open` comes from a saved preference rather than the default, so the screen
 * knows which state is the coach's own choice (never auto-collapsed).
 */
export function useTypesExpanded(defaultOpen: boolean): [boolean, (open: boolean) => void, boolean] {
  const [pref, setPref] = useState<boolean | null | undefined>(typesExpandedCache);

  useEffect(() => {
    if (typesExpandedCache !== undefined) return;
    let cancelled = false;
    void primeTypesExpanded().then((value) => {
      if (!cancelled) setPref(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setOpen = useCallback((open: boolean) => {
    typesExpandedCache = open;
    setPref(open);
    AsyncStorage.setItem(TYPES_EXPANDED_KEY, open ? 'true' : 'false').catch(() => {});
  }, []);

  return [pref ?? defaultOpen, setOpen, typeof pref === 'boolean'];
}
