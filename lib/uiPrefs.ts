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

function parseFlag(raw: string | null): boolean | null {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

/**
 * [open, setOpen] for the dock's outcome types. `defaultOpen` applies until a
 * preference exists (the screen passes one based on the window height);
 * `setOpen` persists the choice.
 */
export function useTypesExpanded(defaultOpen: boolean): [boolean, (open: boolean) => void] {
  const [pref, setPref] = useState<boolean | null | undefined>(typesExpandedCache);

  useEffect(() => {
    if (typesExpandedCache !== undefined) return;
    let cancelled = false;
    AsyncStorage.getItem(TYPES_EXPANDED_KEY)
      .then((raw) => {
        // A toggle that happened while the read was in flight wins.
        if (typesExpandedCache === undefined) typesExpandedCache = parseFlag(raw);
        if (!cancelled) setPref(typesExpandedCache);
      })
      .catch(() => {
        if (!cancelled) setPref(null);
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

  return [pref ?? defaultOpen, setOpen];
}
