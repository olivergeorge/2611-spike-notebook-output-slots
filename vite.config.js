// Build step: `import cells from "./notebook.html?cells"` gives the notebook's transpiled cells.
// Fails the build when index.html names an output the notebook doesn't have.
import {readFileSync} from "node:fs";
import {JSDOM} from "jsdom";
import {deserialize, transpile} from "@observablehq/notebook-kit";
import {defineConfig} from "vite";

const {DOMParser} = new JSDOM().window;
const parse = (file) => new DOMParser().parseFromString(readFileSync(file, "utf8"), "text/html");

function cells() {
  return {
    name: "notebook-cells",
    enforce: "pre",
    load(id) {
      if (!id.endsWith(".html?cells")) return;
      const file = id.slice(0, -"?cells".length);
      this.addWatchFile(file);
      const notebook = deserialize(readFileSync(file, "utf8"), {parser: new DOMParser()});
      const cells = notebook.cells.map((cell) => ({id: cell.id, ...transpile(cell)}));

      const names = new Set(cells.flatMap((c) => (c.output ? [c.output] : c.outputs ?? [])));
      const slots = [...parse("index.html").querySelectorAll("[data-output]")].map((s) => s.dataset.output);
      const missing = slots.filter((name) => !names.has(name));
      if (missing.length) this.error(`index.html names outputs ${file} doesn't have: ${missing.join(", ")} (it has ${[...names].join(", ")})`);

      const fields = ["inputs", "outputs", "output", "autoview", "automutable"];
      const definition = (c) =>
        `{id: ${JSON.stringify(c.id)}, body: ${c.body}, ${fields
          .filter((f) => c[f] !== undefined)
          .map((f) => `${f}: ${JSON.stringify(c[f])}`)
          .join(", ")}}`;
      return `export default [\n${cells.map(definition).join(",\n")}\n];\n`;
    }
  };
}

export default defineConfig({plugins: [cells()]});
