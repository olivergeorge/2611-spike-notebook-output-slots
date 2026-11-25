// Browser: run the notebook's cells in one runtime, displaying nothing,
// then show each output named by a [data-output="name"] slot in that slot.
import {NotebookRuntime} from "@observablehq/notebook-kit/runtime";
import "@observablehq/notebook-kit/inspector.css";
import cells from "./notebook.html?cells";

const notebook = new NotebookRuntime();
const state = (root) => ({root, expanded: [], variables: []});

// Every cell, with Notebook Kit's own define, so it evaluates as in the notebook. Nothing is displayed:
// the cells' display root is never attached to the page.
for (const cell of cells) notebook.define(state(document.createElement("div")), cell);

// The technique: per slot, one more cell that reads the output by name and displays it in the slot.
for (const slot of document.querySelectorAll("[data-output]")) {
  const name = slot.dataset.output;
  notebook.define(state(slot), {id: `slot ${name}`, body: (value) => value, inputs: [name], autodisplay: true});
}
