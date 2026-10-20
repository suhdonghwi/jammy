---
name: react-effects
description: Use before writing, changing or reviewing a useEffect or useLayoutEffect in React code (and when a component copies props into state, reacts to a store counter, or resets state when something changes). Decides whether an Effect is needed and what to write instead, following react.dev's "You Might Not Need an Effect".
---

# React Effects

An Effect is for keeping a component in sync with something outside React **because the component is on screen**: the network, the DOM, a timer, a non-React library (three.js objects, the camera rig, the scene's module stores like `field` or `frogWorld`), a browser API. If nothing outside React is involved, there is almost always a better place for the code.

Ask first: **why does this code run?** Because the user did something → event handler. Because the component is shown → maybe an Effect. Because some value changed → probably neither: derive it.

## Instead of an Effect

| You want to… | Write |
|---|---|
| Compute something from props/state | Compute it during render. `useMemo` only if it is slow and pure. |
| Copy a prop into state "until the user edits" | Derive: `value={editing ? text : String(value)}`; set `text` from the prop in the handler that starts editing. |
| Reset all of a component's state when an id changes | Give it `key={id}` from its parent. |
| Adjust one piece of state when a prop changes | During render, with the previous value in state: `if (value !== seen) { setSeen(value); setX(…) }`. Better: store an id and derive. |
| Clear state when something else changes | Derive it instead: remember *which* thing it belongs to (`refused === formula ? formula.error : null`). |
| React to a user action (show, shake, notify, POST) | Do it in that event handler, from a shared function if several handlers need it. Don't bump a store counter for a component to watch in an Effect. |
| Have an action tell a component what happened | Return a result from the action (`check()` → `'refused'`) and act on it in the component's handler. |
| Read a browser or external store (`matchMedia`, `online`…) | `useSyncExternalStore(subscribe, getSnapshot)`. |
| Measure or observe a DOM node (ResizeObserver) | A ref callback that returns its cleanup (React 19). |
| Start an imperative object in a known state | A prop at creation (`<instancedMesh count={0} />`) or set it where the object is made. |
| Run once for the whole app | Module level, or behind a module flag; not an Effect with `[]` (it runs twice in StrictMode). |
| Wait for a CSS transition | `onTransitionEnd`, not a timer matched to its duration. |
| Restart a CSS animation on demand | `element.animate(keyframes, options)` from the handler. |

## When an Effect is right

- Subscribing to something with cleanup (prefer `useSyncExternalStore` for values).
- Timers tied to what is on screen (an undo window, a "slow" spinner while checking).
- Syncing an imperative system with the current props: the camera for the open level, the scene's stores for the displayed area, disposing three.js geometry and materials (`useEffect(() => () => geom.dispose(), [geom])`).
- Fetching for what is displayed, with an `ignore` flag in the cleanup against races.
- `useLayoutEffect` only when the DOM must be measured or fixed before paint.

Even then: one concern per Effect, a cleanup for everything it starts, and no state set right after mount just to trigger another render if it can be computed instead. Don't silence `react-hooks/exhaustive-deps`: React Compiler skips any component that does.

## Review checklist

For each `useEffect`/`useLayoutEffect` in a diff:

1. Does it touch anything outside React? If not, rewrite it with the table above.
2. Does it only `setState` from props or other state? Derive it, or use `key`, or adjust during render.
3. Is it triggered by a value that a handler just set? Move the work into that handler.
4. Does it clean up every subscription, timer and object it creates?
5. After changing behaviour, exercise it in the running app: the bug these rewrites risk is a value that no longer updates.
