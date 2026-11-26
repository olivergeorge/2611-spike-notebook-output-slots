// Run the notebook's cells in one runtime, then show each output a [data-output="name"] slot names.
import {NotebookRuntime} from "@observablehq/notebook-kit/runtime";
import cells from "./notebook.html?cells";

const notebook = new NotebookRuntime();
const state = (root) => ({root, expanded: [], variables: []});
const slots = document.querySelectorAll("[data-output]");

// Only the cells the slots depend on. Notebook Kit observes every value a JavaScript cell declares, so such a cell runs once defined.
const needed = new Set();
const need = (name) => {
  for (const cell of cells) {
    if (needed.has(cell) || !(cell.output === name || cell.outputs.includes(name))) continue;
    needed.add(cell); // every cell declaring the name, so a duplicate still errors as in the notebook
    cell.inputs.forEach(need);
  }
};
for (const slot of slots) need(slot.dataset.output);

// Each needed cell, with an observer that shows nothing: its values feed the slots instead.
for (const cell of needed) notebook.define(state(document.createElement("div")), cell, () => {});

// The technique: per slot, one more cell that reads the output by name and displays it in the slot.
for (const slot of slots) {
  notebook.define(state(slot), {body: (value) => value, inputs: [slot.dataset.output], autodisplay: true});
}
