import { createContext, useContext } from 'react';

/** Stable controller object created once per editor (methods read refs, so identity never changes). */
export const EditorCtx = createContext(null);
/** Cheap, frequently-changing UI state (selection, drag target). */
export const UiCtx = createContext({ selected: new Set(), drop: null, readOnly: false });

export const useEditor = () => useContext(EditorCtx);
export const useUi = () => useContext(UiCtx);
