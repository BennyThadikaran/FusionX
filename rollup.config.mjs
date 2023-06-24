import { resolve } from "path";
import terser from "@rollup/plugin-terser";
import postcss from "rollup-plugin-postcss";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";

export default {
  input: "./src/public/js/main.js",
  // to get unminified bundle.js, set output as an array
  // output: [{file: "dist/bundle.js", fomat: "es"}, {}]
  output: {
    file: "./dist/bundle.min.js",
    format: "es",
    generatedCode: {
      constBindings: true,
    },
    plugins: [terser({ sourceMap: true })],
  },
  plugins: [
    postcss({
      extract: resolve("./dist/bundle.min.css"),
      plugins: [autoprefixer(), cssnano()],
    }),
  ],
};
