import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * The one dismiss rule for modal sheets and the header back chevron.
 *
 * Go back when there is history to go back to; otherwise (a direct link, a
 * bookmark, a hard reload) replace the screen with its parent route so Close
 * and Back never strand the coach on My Teams.
 */
export function useDismiss(fallbackHref: Href): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  }, [router, fallbackHref]);
}
