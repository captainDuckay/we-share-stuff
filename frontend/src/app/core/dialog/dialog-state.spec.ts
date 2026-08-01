import { describe, expect, it } from 'vitest';
import { DialogState } from './dialog-state';

describe('DialogState', () => {
  it('tracks open dialogs and toggles inert on registered roots', () => {
    const state = new DialogState();
    const root = document.createElement('div');
    state.registerInertRoot(root);

    expect(state.anyOpen()).toBe(false);
    expect(root.inert).toBe(false);

    state.open('a');
    expect(state.anyOpen()).toBe(true);
    expect(root.inert).toBe(true);
    expect(state.openIds()).toEqual(['a']);

    state.open('a');
    expect(state.openIds()).toEqual(['a']);

    state.open('b');
    expect(state.openIds()).toEqual(['a', 'b']);
    expect(root.inert).toBe(true);

    state.close('a');
    expect(state.anyOpen()).toBe(true);
    expect(root.inert).toBe(true);

    state.close('b');
    expect(state.anyOpen()).toBe(false);
    expect(root.inert).toBe(false);

    state.unregisterInertRoot(root);
    expect(root.inert).toBe(false);
  });
});
