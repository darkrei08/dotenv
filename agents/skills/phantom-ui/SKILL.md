---
name: phantom-ui
description: Structure-aware skeleton loading for any framework from one Web Component. Use when adding or replacing loading states and skeleton screens, wiring <phantom-ui> into HTML, React, Vue, Svelte, Angular, Solid, Qwik or HTMX, choosing between skeleton and overlay mode, or fixing content flash before hydration in SSR frameworks.
metadata:
  source: "https://github.com/Aejkatappaja/phantom-ui (npm @aejkatappaja/phantom-ui 1.6.1, MIT, vendored in this directory)"
---

# phantom-ui

Skeleton loading without a second component tree. Wrap the real UI in `<phantom-ui loading>`:
the element renders the children invisibly, measures them, and overlays animated blocks at the
same coordinates. The real component *is* the skeleton template, so a layout change can never
drift away from a hand-written placeholder.

## When to use it

- any region that shows a placeholder while data loads: cards, lists, dashboards, profile rows;
- refresh or stale-while-revalidate flows, where the old content should stay visible but dimmed
  (`mode="overlay"`);
- replacing a hand-built skeleton component;
- SSR frameworks where content flashes before hydration (pair it with `ssr.css`).

Skip it when the loading state has no stable layout (a full-page splash), or when the
placeholder is meant to look nothing like the final content.

## The API

One element, one required attribute:

```html
<phantom-ui loading>
  <div class="card">
    <img src="avatar.png" width="48" height="48" style="border-radius: 50%" />
    <h3>Ada Lovelace</h3>
    <p>First computer programmer, probably.</p>
  </div>
</phantom-ui>
```

`loading` shows the placeholder and hides the children; removing it reveals the real content.
The string `"false"` counts as falsy.

| Attribute | Type | Meaning |
| --- | --- | --- |
| `loading` | boolean | `true` shows the placeholder, absent/`false` shows the content |
| `mode` | `skeleton` \| `overlay` | `skeleton` (default) measures the content and draws blocks; `overlay` keeps the content visible and dimmed under a light sweep |
| `animation` | `shimmer` \| `pulse` \| `breathe` \| `solid` | animation style; `shimmer` is the gradient sweep |
| `shimmer-direction` | `ltr` \| `rtl` \| `ttb` \| `btt` | sweep direction, `shimmer` only |
| `shimmer-color`, `background-color` | CSS color | wave colour and block background |
| `duration` | number (s) | animation cycle duration |
| `stagger` | number (s) | delay between each block's animation start, `0` = none |
| `reveal` | number (s) | fade-out when loading ends, `0` = instant |
| `count`, `count-gap` | number | generate N rows from one template element, gap in px |
| `fallback-radius` | number (px) | radius applied to elements that have none, such as text |
| `loading-label` | string | label announced by screen readers while loading, default `Loading` |
| `debug` | boolean | outline each measured block with its index |
| `data-*` | string | passed straight through |

The element's camelCase properties mirror the attributes: `loading`, `mode`, `animation`,
`shimmerDirection`, `shimmerColor`, `backgroundColor`, `duration`, `stagger`, `reveal`, `count`,
`countGap`, `fallbackRadius`, `loadingLabel`, `debug`, `pierceShadow`, plus `updateComplete`
(a promise: underneath it is a Lit element).

## Install

From the registry, with any package manager:

```bash
npm install @aejkatappaja/phantom-ui   # or bun add / pnpm add / yarn add
```

```ts
import "@aejkatappaja/phantom-ui";     // registers <phantom-ui>
```

Without a build step, or without a registry at all, the CDN script tag works:
`https://cdn.jsdelivr.net/npm/@aejkatappaja/phantom-ui/dist/phantom-ui.cdn.js`.

This repository vendors the standalone build instead, which is the offline path: Lit is bundled
in, there are no runtime dependencies, and two files are the whole install. Copy
`phantom-ui.standalone.js` and `phantom-ui.standalone.d.ts` next to the code and import by path.
TypeScript pairs a declaration to a module by exact filename, so those two names travel together
and nothing needs configuring:

```ts
import "./phantom-ui.standalone.js";
import type { PhantomUi } from "./phantom-ui.standalone.js";
```

The declared class extends `HTMLElement` rather than `LitElement` — a narrower view of the same
instance — and the declarations reference nothing external, so `strict` with
`skipLibCheck: false` still type-checks in a project that has no `node_modules`. Version and
integrity of the vendored pair are recorded in `VENDORED.md`, next to them.

## Framework wiring

The element works anywhere a custom element does: plain HTML, React, Vue, Svelte, Angular,
Solid, Qwik, HTMX. Nothing needs adapting beyond types and SSR CSS.

```bash
npx @aejkatappaja/phantom-ui init   # from the project root
```

`init` does the two optional steps and nothing else — the library deliberately ships no
`postinstall`, so sources are never modified unless asked:

- **JSX declarations** for React, Solid and Qwik: writes `src/phantom-ui.d.ts`;
- **SSR pre-hydration CSS** for Next.js, Nuxt, SvelteKit, Remix and Qwik: adds
  `import "@aejkatappaja/phantom-ui/ssr.css"` to the layout file.

Manually, the declaration is a `declare module` block for that framework's JSX namespace, and the
SSR import goes into the root layout: `app/layout.tsx` (Next App Router), `pages/_app.tsx`
(Next Pages), `app.vue` (Nuxt), `src/routes/+layout.svelte` (SvelteKit), `app/root.tsx` (Remix),
`src/root.tsx` (Qwik). Vue, Svelte and Angular need no declaration at all.

## Rules that keep it honest

- One wrapper per loading region, not one per element: wrap the region that maps to one fetch.
- Children stay in the DOM while loading (only made invisible), so their text is what defines the
  placeholder's shape. Put representative content there, never filler text.
- Never keep a parallel skeleton component. Two trees means the drift is back, which is the whole
  problem this replaces.
- The container's spacing, background and borders belong to the content's own CSS: the element
  overlays blocks, it does not invent a layout.
- `mode="overlay"` for refresh, `skeleton` for the first load.
- Keep `loading-label` meaningful in the interface's language: it is what a screen reader
  announces while the region is loading.
- Do not hand-edit the vendored files. Refresh them with the procedure in `VENDORED.md` so the
  recorded version and integrity stay true.

## References

- upstream docs: <https://aejkatappaja.github.io/phantom-ui/> (attributes, CSS custom properties,
  data attributes, TypeScript, per-framework guides, SSR)
- live demo: <https://aejkatappaja.github.io/phantom-ui/demo/>
- license: MIT — `LICENSE` sits next to the vendored files and must travel with them
