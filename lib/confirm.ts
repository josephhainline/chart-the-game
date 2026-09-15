import { Alert, Platform } from 'react-native';

/**
 * Ask the user to confirm a destructive action.
 *
 * Native uses Alert. Web uses the in-app dialog rendered by
 * `components/ConfirmDialog` (mounted once in the root layout): React Native
 * Web's Alert is a no-op, and `window.confirm` is silently ignored inside the
 * sandboxed frames that artifact hosts embed the app in, which made every
 * confirmation cancel itself.
 */
export type ConfirmRequest = {
  id: number;
  title: string;
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
};

let nextId = 1;
let pending: ConfirmRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** The request the dialog should show, if any (web only). */
export function getPendingConfirm(): ConfirmRequest | null {
  return pending;
}

export function subscribeConfirm(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by the dialog with the user's answer. */
export function answerConfirm(id: number, ok: boolean): void {
  if (!pending || pending.id !== id) return;
  const { resolve } = pending;
  pending = null;
  emit();
  resolve(ok);
}

export function confirmAction(title: string, message: string, confirmLabel = 'Delete'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      // A second request while one is open answers the first with "no".
      if (pending) pending.resolve(false);
      pending = { id: nextId++, title, message, confirmLabel, resolve };
      emit();
    });
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
