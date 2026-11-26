# Notebook outputs into template slots, by name

**[Live demo](https://olivergeorge.github.io/2611-spike-notebook-output-slots/)**

> A spike from November 2026: a point-in-time effort, not maintained.

A minimal proof of concept: write components in an [Observable Notebook Kit](https://observablehq.com/notebook-kit/) notebook, then lay them out in a plain HTML + CSS page that refers to them by name.

```html
<div data-output="chart"></div>
```

```bash
npm install
npm run dev
```

`index.html` is a dashboard: the slider, the summary and the chart sit in different parts of the page and react together.

This is offered as a data point for [observablehq/notebook-kit#103](https://github.com/observablehq/notebook-kit/pull/103) ("Layout templates"), which changes Notebook Kit's Vite plugin ([`src/vite/observable.ts`](https://github.com/observablehq/notebook-kit/blob/v2.12.0/src/vite/observable.ts)). We run a larger version of this technique on a production static site, which owns its own page host. This repository is the technique with everything else removed.

---

## ADR: Bind template slots to notebook values by name, in a host outside Notebook Kit's page

### Context

**The need.** PR #103 states it: build components in a notebook, then use a vanilla HTML + CSS template that places them "by just referring to cell names", like a `<Cell id={i} />` hooked into a shared runtime. The PR renders each cell into an existing `<div id="cell-${id}">` when the page has one. It also names the friction: cell ids appear nowhere in the UI.

**Cells and values.** In Notebook Kit 2.x, cells have numeric ids and no names, while top-level declarations (`const chart = …`) and [`output="…"` attributes](https://observablehq.com/notebook-kit/kit#the-notebook-file-format) create named runtime variables. What a cell *displays* ([`display()`, expression cells, the input inside `const x = view(…)`](https://observablehq.com/notebook-kit/system-guide#java-script)) is separate from the values it *declares*. A JavaScript declaration displays nothing on its own; a cell with an `output` attribute still displays unless it is `hidden`.

**The questions that shape the design:**

1. What does the template name: a cell, or a value?
2. Where does the binding live: inside Notebook Kit's page, or in a host outside it?
3. What happens to a cell no slot names?
4. How do notebooks map to pages: does a page show one notebook, and does a notebook appear on one page?

**The options:**

| | Slot binds to | `view()`, `display()` | Kit's page features | Unslotted cells | Notebooks to pages | Kit change |
|---|---|---|---|---|---|---|
| A. Cell ids (PR #103) | `cell-3` → the cell's display | work | kept | rendered as now | 1 : 1 | 4 lines |
| B. Named cells | a name the cell declares, or one on its `<script>` → the cell's display | work | kept | as A, or a rule | 1 : 1 | small |
| C. Placement in code | `display(value, target)` → the target | changed | kept | rendered as now | 1 : 1 | API change |
| D. Values by name (this repo) | `chart` → the variable's value | not slottable | left to the host | not defined, so never run | many : many | none |
| E. Observable Framework | no notebook: code sits in the page | work | Framework's own | n/a | n/a (pages import code) | a different tool |

- **A** keeps the authoring model whole, but cell ids aren't shown in the editor, change when a cell is recreated, and a mistyped one silently falls back to the default placement.
- **B** is the smallest fix to A. A name the cell already declares (`const chart`) needs no file-format or editor change; a new attribute, like an id, would need the editor to show it. Its open questions are whether unslotted cells still render and what `width` means in a narrow slot.
- **C** (floated on the PR) ties the notebook to one page's regions.
- **D** is classic Observable embedding by variable name, adapted to Notebook Kit. The authoring model shrinks to named values, but any page can pull from one notebook.
- **E** already does custom layouts, if authoring in Framework pages rather than a notebook is an option.

**Our situation.** Notebook Kit's Vite plugin compiles each notebook into its own page, one to one, which suits A, B and C. Our site already has its own templates and page host, wants notebooks to supply values and never layout, and maps notebooks to pages many to many: one notebook's values appear on several pages, and one page draws on several notebooks.

### Decision

**D: the template names values, and a small host outside Notebook Kit's page fills each slot.** A and B are about where a notebook's own page puts its cells. Our pages aren't one notebook's page. C would put our layout in the notebook. E would replace the notebook as the place analysts work.

For Notebook Kit's own page, we'd recommend **B**. It gives PR #103 readable handles and keeps the authoring model whole.

How it works:

1. **Build** (`vite.config.js`): a Vite plugin turns `notebook.html?cells` into the cells' definitions, using Notebook Kit's [`deserialize`](https://observablehq.com/notebook-kit/kit#utility-api) and [`transpile`](https://observablehq.com/notebook-kit/kit#build-api). The build fails if `index.html` names a value the notebook doesn't have.
2. **Run** (`slots.js`): the host follows each slot's name back through the cells' inputs, and defines only the cells it reaches in one [`NotebookRuntime`](https://observablehq.com/notebook-kit/kit#runtime-api) with Notebook Kit's own [`define`](https://github.com/observablehq/notebook-kit/blob/v2.12.0/src/runtime/define.ts). It has to filter: `define` observes every value a JavaScript cell declares, so such a cell runs once defined, slotted or not. Passing `() => {}` as the observer factory means these cells display nothing.
3. **Bind** (`slots.js`): each `[data-output="name"]` gets one more cell, defined the same way, whose body is `(value) => value`, whose input is `name` and whose display root is the slot. Notebook Kit's own display code shows the value, so a DOM node goes in as it is and an error shows as the notebook would show it.

```js
notebook.define({root: slot, expanded: [], variables: []},
  {body: (value) => value, inputs: [slot.dataset.output], autodisplay: true});
```

### Consequences

Gains:

- **Readable handles.** The template says `chart`, the name in the notebook's source, not an id the editor never shows. Splitting or rewriting the cell that declares it doesn't change it.
- **One shared runtime.** Slots anywhere on the page stay reactive with each other: the slider in the sidebar redraws the chart in the main column.
- **Only what's slotted runs.** Cells no slot depends on are never defined, so never run. The notebook can keep its own preview cells (cell 6 displays the input and the chart, so `notebook.html` reads properly in Notebook Kit), and the host never runs them.
- **Errors show where the value would.** A cell that throws shows `RuntimeError: …` in its slot, and the stale chart is gone.
- **Mistakes fail at build.** A misspelt slot stops `vite build`, and shows Vite's error overlay in dev.
- **No change to Notebook Kit,** and the notebook doesn't know where its values go.

Costs and limits:

- **Values, not displays.** A slot gets a variable's value. Anything a cell only displays has no name and no slot: an expression cell, a `display()` call, the input element inside `const x = view(…)`. The notebook therefore keeps the input element and its value apart (`thresholdInput`, and `threshold = Generators.input(thresholdInput)`), which is the boilerplate `view()` exists to remove.
- **One slot per name.** A DOM node can only be in one place. Notebook Kit won't move a node that is already attached elsewhere, so a second slot naming `chart` shows it in the inspector instead.
- **Several notebooks need separate scopes.** This repository shows one notebook. Two notebooks may declare the same name, so a page that draws on several needs a `NotebookRuntime` (or runtime module) per notebook, and slots that say which notebook they mean. Our production host does this; it isn't shown here.
- **A name is a contract.** Renaming a variable breaks the template. The build catches it, but nothing renames it for you.
- **Most of Notebook Kit's page is left behind.** Its Vite plugin does more than run cells, such as static Markdown rendering, `FileAttachment` and database resolution, `npm:` and `jsr:` imports, and themes. This host does none of that. Our production host re-implements the parts it needs, which is a real cost.
- **It leans on details we've only checked against 2.12.0.** `define` and its state object are part of Notebook Kit's documented [Runtime API](https://observablehq.com/notebook-kit/kit#runtime-api), and reading a value through one more cell is how the [Observable runtime](https://github.com/observablehq/runtime) works. Which cells run, though, is `define`'s business: it observes every value a JavaScript cell declares, so the host does its own filtering. A documented way to mount a named value into an element would serve any external host, whichever way PR #103 goes.
- **`width` is page-wide, not per slot.** It [measures the first `<main>`, else `<body>`](https://github.com/observablehq/notebook-kit/blob/v2.12.0/src/runtime/stdlib/index.ts), so a chart in a narrow column needs its own width. Here the chart column is the page's `<main>`, which works for one column only. Options A and B face the same question.

### React

React doesn't change the technique, but it could package it. None of this is tested here. A framework-neutral custom element, `<notebook-output name="chart">`, should work in React 19, Astro or plain HTML alike. React 19's ref callbacks can return a cleanup, so a component could define the slot variable on mount and delete its variables on unmount. Where a component wants the value rather than its DOM node, an observer that caches the latest value could feed `useSyncExternalStore`, since the runtime reports values asynchronously. React leaves the hard parts as they are: naming values rather than cells, the `view()` element/value split, a runtime per notebook, and unslotted cells. The reverse direction already exists: Notebook Kit displays React elements a cell returns.

## Notebook Kit references

Docs:

- [Notebook Kit](https://observablehq.com/notebook-kit/), and its [file format](https://observablehq.com/notebook-kit/kit#the-notebook-file-format), [Vite plugin](https://observablehq.com/notebook-kit/kit#vite-api), [build API](https://observablehq.com/notebook-kit/kit#build-api), [utility API](https://observablehq.com/notebook-kit/kit#utility-api) and [runtime API](https://observablehq.com/notebook-kit/kit#runtime-api)
- [System guide: JavaScript](https://observablehq.com/notebook-kit/system-guide#java-script): top-level variables, `display()` and `view()`
- [Observable runtime](https://github.com/observablehq/runtime): modules, variables and observers

Source, at v2.12.0 (the version this repo pins):

- [`src/runtime/index.ts`](https://github.com/observablehq/notebook-kit/blob/v2.12.0/src/runtime/index.ts): `NotebookRuntime`
- [`src/runtime/define.ts`](https://github.com/observablehq/notebook-kit/blob/v2.12.0/src/runtime/define.ts): `define`, observers and display roots
- [`src/runtime/display.ts`](https://github.com/observablehq/notebook-kit/blob/v2.12.0/src/runtime/display.ts): how values and errors are shown
- [`src/runtime/stdlib/index.ts`](https://github.com/observablehq/notebook-kit/blob/v2.12.0/src/runtime/stdlib/index.ts): `width`
- [`src/javascript/transpile.ts`](https://github.com/observablehq/notebook-kit/blob/v2.12.0/src/javascript/transpile.ts) and [`src/lib/serialize.ts`](https://github.com/observablehq/notebook-kit/blob/v2.12.0/src/lib/serialize.ts): `transpile` and `deserialize`
- [`src/vite/observable.ts`](https://github.com/observablehq/notebook-kit/blob/v2.12.0/src/vite/observable.ts): the Vite plugin, which PR #103 changes

## Files

| File | What |
|---|---|
| `notebook.html` | The components: a Notebook Kit notebook |
| `index.html` | The layout: plain HTML + CSS with `data-output` slots |
| `vite.config.js` | Build: `notebook.html?cells`, plus the slot check |
| `slots.js` | Browser: the runtime and the slot binding |
