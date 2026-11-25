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

**The need.** PR #103 states it: build components in a notebook, then use a vanilla HTML + CSS template that places them "by just referring to cell names", like a `<Cell id={i} />` hooked into a shared runtime. The PR renders each cell into an existing `<div id="cell-${id}">` when the page has one. It also names the friction: cell ids appear nowhere in the UI.

**What the format gives us.** In Notebook Kit 2.x, cells have numeric ids and no names, but values do. Each top-level declaration (`const chart = …`) becomes a runtime variable, and a Markdown, HTML or SQL cell can name its value with the `output` attribute. What a cell *shows* is separate from what it *declares*. A declaration shows nothing, while `display()`, expression cells and `view()` show things that have no name: `const x = view(Inputs.range(…))` shows the input element but binds `x` to its value. Notebook Kit's Vite plugin also does static Markdown and HTML rendering, `FileAttachment` and database resolution, SQL result caching and themes.

**The questions that shape the design:**

1. What does the template name: a cell, or a value?
2. Where does the binding live: inside Notebook Kit's page, or in a host outside it?
3. What happens to a cell no slot names?

**The options:**

| | Template names | A slot gets | `view()`, `display()` | Notebook Kit's page features | Cells with no slot | Change to Notebook Kit |
|---|---|---|---|---|---|---|
| A. Cell ids (PR #103) | `cell-3` | the cell's display | work | kept | appended to `<main>` | 4 lines |
| B. Named cells | `slot="controls"` on the cell's `<script>` | the cell's display | work | kept | needs a rule | small |
| C. Placement in code | `display(value, "controls")` | what the cell displays there | changed | kept | n/a | API change |
| D. Values by name, outside host | `chart`, a variable | the variable's value | lose their element | lost | never run | none |
| E. Observable Framework | n/a: the page is a Framework page | n/a | work | Framework's own | n/a | none; a different tool |

- **A. Cell ids** is the PR as written: tiny, and the authoring model stays whole. But the handle is opaque: it appears nowhere in the editor, and a split or recreated cell gets a new one. A wrong id silently falls back to appending.
- **B. Named cells** keeps everything A keeps and fixes the handle. It still has to decide whether unslotted cells append to `<main>` or are left out, and what `width` means in a narrow slot. This is the smallest fix to A.
- **C. Placement in code**, the PR's own fallback idea, puts layout knowledge in the notebook. Each cell has to know which region of the page it belongs to.
- **D. Values by name** is the classic Observable embedding pattern, `runtime.module(define, (name) => { if (name === "chart") return new Inspector(el); })`, on Notebook Kit. Only named values can be placed, so the authoring model shrinks, and the host must do whatever Notebook Kit's page did that it needs. In exchange, the notebook becomes a source of values that any page can use.
- **E. Observable Framework** already does reactive JavaScript inside hand-laid-out pages. It meets the layout need if you author in Framework rather than in a notebook.

**Our situation.** The site already has its own templates and its own page host. It wants the notebook to supply values, never layout. One notebook's values appear on several pages, each placing them differently.

### Decision

**D: the template names values, and a small host outside Notebook Kit's page fills each slot.** A and B are about where a notebook's own page puts its cells. Our pages aren't the notebook's page. C would put our layout in the notebook. E would replace the notebook as the place analysts work.

For Notebook Kit's own page, we'd recommend **B**. It gives PR #103 readable handles without losing anything the authoring model has.

How it works:

1. **Build** (`vite.config.js`): a Vite plugin turns `notebook.html?cells` into the cells' definitions, using Notebook Kit's `deserialize` and `transpile`. The build fails if `index.html` names a value the notebook doesn't have.
2. **Run** (`slots.js`): every cell is defined in one `NotebookRuntime` with Notebook Kit's own `define`, but with no observer. That keeps them lazy: a cell runs only when a slot needs its value, and displays nothing.
3. **Bind** (`slots.js`): each `[data-output="name"]` gets one more cell, defined the same way, whose body is `(value) => value`, whose input is `name` and whose display root is the slot. Notebook Kit's own display code shows the value, so a DOM node, any other value and an error each appear as a notebook shows them.

```js
notebook.define({root: slot, expanded: [], variables: []},
  {body: (value) => value, inputs: [slot.dataset.output], autodisplay: true});
```

### Consequences

Gains:

- **Readable handles.** The template says `chart`, the name in the notebook's source, not an id the editor never shows. Splitting or rewriting the cell that declares it doesn't change it.
- **One shared runtime.** Slots anywhere on the page stay reactive with each other: the slider in the sidebar redraws the chart in the main column.
- **Only what's slotted runs.** Cells no slot depends on never run. The notebook can keep its own preview cells (cell 6 displays the input and the chart, so `notebook.html` reads properly in Notebook Kit), and the host never runs them.
- **Errors show where the value would.** A cell that throws shows `RuntimeError: …` in its slot, and the stale chart is gone.
- **Mistakes fail at build.** A misspelt slot stops the build and lists the names that exist.
- **No change to Notebook Kit,** and the notebook doesn't know where its values go.

Costs and limits:

- **Values, not displays.** A slot gets a variable's value. Anything a cell only displays has no name and no slot: an expression cell, a `display()` call, the input element inside `const x = view(…)`. The notebook therefore keeps the input element and its value apart (`thresholdInput`, and `threshold = Generators.input(thresholdInput)`), which is the boilerplate `view()` exists to remove.
- **One slot per name.** A DOM node can only be in one place, so two slots naming `chart` take it from each other.
- **A name is a contract.** Renaming a variable breaks the template. The build catches it, but nothing renames it for you.
- **Most of Notebook Kit's page is left behind.** Its Vite plugin does static Markdown and HTML rendering, `FileAttachment` and database resolution, SQL result caching and themes. This host does none of that. Our production host re-implements the parts it needs, which is a real cost.
- **An undocumented seam.** The state object passed to `define` (`{root, expanded, variables}`) is internal plumbing. A small documented way to mount a named value into an element would serve any external host, whichever way PR #103 goes.
- **`width` measures `<main>`, not the slot,** so a chart in a narrow column needs its own width. Options A and B have the same problem.

## Files

| File | What |
|---|---|
| `notebook.html` | The components: a Notebook Kit notebook |
| `index.html` | The layout: plain HTML + CSS with `data-output` slots |
| `vite.config.js` | Build: `notebook.html?cells`, plus the slot check |
| `slots.js` | Browser: the runtime and the slot binding |
