// Run the notebook's cells in one runtime, then show each output a [data-output="name"] slot names.
import {NotebookRuntime} from "@observablehq/notebook-kit/runtime";
import cells from "./notebook.html?cells";

const notebook = new NotebookRuntime();
const state = (root) => ({root, expanded: [], variables: []});

// Every cell, with no observer: lazy, so it runs only when a slot needs its value, and shows nothing.
for (const cell of cells) notebook.define(state(document.createElement("div")), cell, () => {});

// The technique: per slot, one more cell that reads the output by name and displays it in the slot.
for (const slot of document.querySelectorAll("[data-output]")) {
  notebook.define(state(slot), {body: (value) => value, inputs: [slot.dataset.output], autodisplay: true});
}
