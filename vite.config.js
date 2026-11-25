// `import cells from "./notebook.html?cells"` gives the notebook's transpiled cells.
// The build fails when index.html names an output the notebook doesn't have.
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {JSDOM} from "jsdom";
import {deserialize, transpile} from "@observablehq/notebook-kit";

const parser = new (new JSDOM().window.DOMParser)();
const read = (file) => parser.parseFromString(readFileSync(file, "utf8"), "text/html");
const template = resolve("index.html");

const cells = {
  name: "notebook-cells",
  load(id) {
    if (!id.endsWith(".html?cells")) return;
    this.addWatchFile(template); // so an edit to index.html is checked again in dev
    const file = id.slice(0, -"?cells".length);
    const cells = deserialize(readFileSync(file, "utf8"), {parser}).cells.map((cell) => ({id: cell.id, ...transpile(cell)}));

    const names = cells.flatMap((c) => c.output ?? c.outputs);
    const missing = [...read(template).querySelectorAll("[data-output]")].map((s) => s.dataset.output).filter((n) => !names.includes(n));
    if (missing.length) this.error(`index.html names outputs the notebook doesn't have: ${missing.join(", ")}`);

    return `export default [${cells.map(({body, ...rest}) => `{...${JSON.stringify(rest)}, body: ${body}}`)}];`;
  }
};

export default {plugins: [cells]};
