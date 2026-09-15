import type React from 'react';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Hook = [boolean, (open: boolean) => void, boolean];

// react-test-renderer ships no type declarations in this project, so type just what we use.
type Renderer = { unmount(): void };
type TestRenderer = {
  create(element: React.ReactElement): Renderer;
  act(callback: () => void): void;
  act(callback: () => Promise<void>): Promise<void>;
};

/**
 * The module keeps a session cache of the saved preference, so every case
 * loads a fresh registry (React and the renderer included, so the hook sees
 * one React) with the storage seeded as the case needs.
 */
async function fresh(saved?: 'true' | 'false') {
  jest.resetModules();
  const React = require('react') as typeof import('react');
  const { act, create } = require('react-test-renderer') as TestRenderer;
  // The jest mock is a plain CommonJS object; the real module exports a default.
  type Storage = { clear(): Promise<void>; getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
  const storageModule = require('@react-native-async-storage/async-storage') as Storage & { default?: Storage };
  const storage: Storage = storageModule.default ?? storageModule;
  const prefs = require('../uiPrefs') as typeof import('../uiPrefs');
  await storage.clear();
  if (saved) await storage.setItem(prefs.TYPES_EXPANDED_KEY, saved);

  const mount = async (defaultOpen: boolean) => {
    let latest: Hook | undefined;
    function Probe() {
      latest = prefs.useTypesExpanded(defaultOpen);
      return null;
    }
    let root: Renderer | undefined;
    await act(async () => {
      root = create(React.createElement(Probe));
    });
    const first = latest as Hook;
    // Let the storage read settle.
    await act(async () => {
      await Promise.resolve();
    });
    return {
      first,
      get: () => latest as Hook,
      set: async (open: boolean) => {
        await act(async () => {
          (latest as Hook)[1](open);
        });
      },
      unmount: () => root?.unmount(),
    };
  };
  return { act, storage, prefs, mount };
}

describe('useTypesExpanded', () => {
  it('reports the caller default as not explicit while nothing is saved', async () => {
    const { mount } = await fresh();
    const open = await mount(true);
    expect(open.get()[0]).toBe(true);
    expect(open.get()[2]).toBe(false);
    open.unmount();
    const closed = await mount(false);
    expect(closed.get()[0]).toBe(false);
    expect(closed.get()[2]).toBe(false);
  });

  it('a saved preference wins over the default and is explicit', async () => {
    const savedOpen = await fresh('true');
    const a = await savedOpen.mount(false);
    expect(a.get()[0]).toBe(true);
    expect(a.get()[2]).toBe(true);

    const savedClosed = await fresh('false');
    const b = await savedClosed.mount(true);
    expect(b.get()[0]).toBe(false);
    expect(b.get()[2]).toBe(true);
  });

  it('setOpen persists the choice and makes it explicit', async () => {
    const { storage, prefs, mount } = await fresh();
    const h = await mount(true);
    expect(h.get()[2]).toBe(false);
    await h.set(false);
    expect(h.get()[0]).toBe(false);
    expect(h.get()[2]).toBe(true);
    expect(await storage.getItem(prefs.TYPES_EXPANDED_KEY)).toBe('false');
    // A remount shows the saved choice on its first render (session cache).
    h.unmount();
    const again = await mount(true);
    expect(again.first[0]).toBe(false);
    expect(again.first[2]).toBe(true);
  });

  it('primeTypesExpanded warms the cache so the first render is the saved state', async () => {
    const { prefs, mount } = await fresh('true');
    expect(await prefs.primeTypesExpanded()).toBe(true);
    const h = await mount(false);
    expect(h.first[0]).toBe(true);
    expect(h.first[2]).toBe(true);
  });

  it('reads storage once however often the primer and the hook ask', async () => {
    const { storage, prefs, mount } = await fresh('false');
    const read = jest.spyOn(storage, 'getItem');
    await Promise.all([prefs.primeTypesExpanded(), prefs.primeTypesExpanded(), prefs.primeTypesExpanded()]);
    const a = await mount(true);
    a.unmount();
    const b = await mount(true);
    expect(b.get()[0]).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('resolves null for nothing saved or an unreadable value, leaving the default in charge', async () => {
    const empty = await fresh();
    expect(await empty.prefs.primeTypesExpanded()).toBeNull();
    const h = await empty.mount(true);
    expect(h.get()[0]).toBe(true);
    expect(h.get()[2]).toBe(false);

    const garbage = await fresh();
    await garbage.storage.setItem(garbage.prefs.TYPES_EXPANDED_KEY, 'maybe');
    expect(await garbage.prefs.primeTypesExpanded()).toBeNull();
    const g = await garbage.mount(false);
    expect(g.get()[0]).toBe(false);
    expect(g.get()[2]).toBe(false);
  });

  it('a toggle while the read is in flight wins and is what gets persisted', async () => {
    const { act, storage, prefs, mount } = await fresh();
    // A slow native read that would say "closed" once it lands. The jest mock's
    // getItem is already a jest.fn, so keep its implementation to put back.
    const read = jest.spyOn(storage, 'getItem');
    const realRead = read.getMockImplementation();
    read.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('false'), 30)));
    const h = await mount(false);
    expect(h.get()[0]).toBe(false);
    await h.set(true);
    expect(h.get()[0]).toBe(true);
    expect(h.get()[2]).toBe(true);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(h.get()[0]).toBe(true);
    expect(h.get()[2]).toBe(true);
    if (realRead) read.mockImplementation(realRead);
    else read.mockRestore();
    expect(await storage.getItem(prefs.TYPES_EXPANDED_KEY)).toBe('true');
    // A later mount sees the coach's choice, not the stale read.
    h.unmount();
    const again = await mount(false);
    expect(again.first[0]).toBe(true);
  });
});
