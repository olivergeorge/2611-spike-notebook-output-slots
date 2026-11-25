# Notebook outputs into template slots, by name

A minimal proof of concept: write components in an [Observable Notebook Kit](https://github.com/observablehq/notebook-kit) notebook, then lay them out in a plain HTML + CSS page that refers to them by name.

```html
<div data-output="chart"></div>
```

```bash
npm install
npm run dev
```

`index.html` is a dashboard: the slider, the summary and the chart sit in different parts of the page and react together.

This is offered as a data point for [observablehq/notebook-kit#103](https://github.com/observablehq/notebook-kit/pull/103) ("Layout templates"). We run a larger version of this technique on a production static site, which owns its own page host. This repository is the technique with everything else removed.

---

## ADR: Bind template slots to notebook values by name, in a host outside Notebook Kit's page

### Context

PR #103 renders each cell into an existing `<div id="cell-${id}">` when the page has one, so an author can stub out a layout and have the cells fill it. The PR names the need: build components in a notebook, then use a vanilla HTML + CSS template that places them "by just referring to cell names", like a `<Cell id={i} />` hooked into a shared runtime. It also names the friction: cell ids appear nowhere in the UI.

Cells have no names, but values do. Each top-level declaration (`const chart = …`) becomes a runtime variable, and a Markdown, HTML or SQL cell can take one with the `output` attribute (`<script type="text/markdown" output="summary">`). The Observable runtime lets any code read a variable by name.

Our context: the site already has its own templates and its own page host, and wants the notebook to supply values, not layout.

### Decision

The template names **values**, not cells. A small host, outside Notebook Kit's own page, fills each slot.

1. **Build** (`vite.config.js`): a Vite plugin turns `notebook.html?cells` into the cells' definitions, using Notebook Kit's `deserialize` and `transpile`. The build fails if `index.html` names a value the notebook doesn't have.
2. **Run** (`slots.js`): every cell is defined in one `NotebookRuntime` with Notebook Kit's own `define`, but with no observer. That keeps them lazy: a cell runs only when a slot needs its value, and displays nothing.
3. **Bind** (`slots.js`): each `[data-output="name"]` gets one more cell, defined the same way, whose body is `(value) => value`, whose input is `name` and whose display root is the slot. Notebook Kit's own display code shows the value, so a DOM node, an inspected object and an error each appear the way a notebook would show them.

```js
notebook.define({root: slot, expanded: [], variables: []},
  {id: `slot ${name}`, body: (value) => value, inputs: [name], autodisplay: true});
```

### Consequences

Gains:

- **Readable handles.** The template says `chart`, the name in the notebook's source. Reordering or editing cells never changes it.
- **One shared runtime.** Slots anywhere on the page stay reactive with each other: the slider in the sidebar redraws the chart in the main column.
- **Only what's slotted runs.** Cells no slot depends on never run. The notebook can keep its own preview cells (cell 7 displays the input and the chart, so `notebook.html` reads properly in Notebook Kit), and the host never runs them.
- **Errors show where the value would.** A cell that throws shows `RuntimeError: …` in its slot, and the stale chart is gone.
- **Mistakes fail at build.** A misspelt slot stops the build and lists the names that exist.
- **No change to Notebook Kit,** and the notebook doesn't know where its values go.

Costs and limits:

- **Values, not displays.** A slot gets a variable's value. Anything a cell only displays has no name and no slot: an expression cell, a `display()` call, the input element inside `const x = view(…)`. The notebook therefore keeps the input element and its value apart (`thresholdInput`, and `threshold = Generators.input(thresholdInput)`), which is the boilerplate `view()` exists to remove.
- **One slot per name.** A DOM node can only be in one place, so two slots naming `chart` take it from each other.
- **A name is a contract.** Renaming a variable breaks the template. The build catches it, but nothing renames it for you.
- **Most of Notebook Kit's page is left behind.** Its Vite plugin does static Markdown and HTML rendering, `FileAttachment` and database resolution, SQL result caching and themes. This host does none of that. Our production host re-implements the parts it needs, which is a real cost.
- **An undocumented seam.** The state object passed to `define` (`{root, expanded, variables}`) is internal plumbing. A small documented way to mount a named value into an element would serve any external host, whichever way PR #103 goes.
- **`width` measures `<main>`, not the slot,** so a chart in a narrow column needs its own width. PR #103's cell slots have the same problem.

### Compared with PR #103

The two bind different things. PR #103 moves a cell's **display**. This moves a variable's **value**.

- PR #103 keeps the notebook's authoring model whole: `view()`, `display()`, expression cells and Notebook Kit's page features all work. Its wart is the handle, the numeric id. A readable name attribute on the cell's `<script>` would fix that upstream in a few lines. It still has to decide what happens to a cell with no slot (append to `<main>`, or leave it out) and what `width` means in a narrow slot.
- This approach suits a site that already owns its host and templates, and wants the notebook to be a source of values. It gives up the parts of the authoring model listed above to get there.

For Notebook Kit's own page, readable cell names on PR #103's approach look like the better fit. This repository is the other branch, at its smallest.

## Files

| File | What |
|---|---|
| `notebook.html` | The components: a Notebook Kit notebook |
| `index.html` | The layout: plain HTML + CSS with `data-output` slots |
| `vite.config.js` | Build: `notebook.html?cells`, plus the slot check |
| `slots.js` | Browser: the runtime and the slot binding |
