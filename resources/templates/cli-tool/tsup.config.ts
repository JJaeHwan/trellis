import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cmd/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist/cmd",
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
