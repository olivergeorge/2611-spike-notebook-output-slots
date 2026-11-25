// Build step: `import cells from "./notebook.html?cells"` gives the notebook's transpiled cells.
// Fails the build when index.html names an output the notebook doesn't have.
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {JSDOM} from "jsdom";
import {deserialize, transpile} from "@observablehq/notebook-kit";
import {defineConfig} from "vite";

const parser = new (new JSDOM().window.DOMParser)();
const template = resolve("index.html");

function cells() {
  return {
    name: "notebook-cells",
    enforce: "pre",
    load(id) {
      if (!id.endsWith(".html?cells")) return;
      const file = id.slice(0, -"?cells".length);
      this.addWatchFile(file);
      this.addWatchFile(template);
      const notebook = deserialize(readFileSync(file, "utf8"), {parser});
      const cells = notebook.cells.map((cell) => ({id: cell.id, ...transpile(cell)}));

      const names = new Set(cells.flatMap((c) => (c.output ? [c.output] : c.outputs ?? [])));
      const page = parser.parseFromString(readFileSync(template, "utf8"), "text/html");
      const missing = [...page.querySelectorAll("[data-output]")].map((s) => s.dataset.output).filter((n) => !names.has(n));
      if (missing.length) this.error(`${template} names outputs ${file} doesn't have: ${missing.join(", ")} (it has ${[...names].join(", ")})`);

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
