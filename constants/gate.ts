import { Platform } from 'react-native';

/**
 * TEMPORARY: the public site stops at the intro.
 *
 * chartthegame.com is reachable by anyone and the demo season carries real
 * youth players' names, so until there is a real login (accounts + sync, see
 * the login issue) visitors get the intro and no further.
 *
 * This is a hold, not security: the whole app still ships in the bundle, and
 * anyone who opens devtools can walk past it. It keeps a stray visitor out of
 * the roster, nothing more.
 *
 * To open the site again: set `INTRO_ONLY` to false (and delete this file plus
 * its two uses once the real login lands).
 *
 * To look at the app on a locked build, in the browser console:
 *   localStorage.setItem('ctg:unlock', '1')
 */
const INTRO_ONLY = true;

/** The key that lifts the hold for one browser. */
const UNLOCK_KEY = 'ctg:unlock';

/** True when this visitor must stay on the intro. Native builds are never held. */
export function introOnly(): boolean {
  if (!INTRO_ONLY || Platform.OS !== 'web') return false;
  try {
    return window.localStorage.getItem(UNLOCK_KEY) !== '1';
  } catch {
    // Private windows and the static export's prerender have no storage: hold.
    return true;
  }
}
