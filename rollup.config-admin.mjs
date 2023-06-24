import terser from "@rollup/plugin-terser";

export default {
  input: "./src/public/js/admin.js",
  // to get unminified bundle.js, set output as an array
  // output: [{file: "dist/bundle.js", fomat: "es"}, {}]
  output: {
    file: "./dist/admin.min.js",
    format: "es",
    generatedCode: {
      constBindings: true,
    },
    plugins: [terser({ sourceMap: true })],
  },
};
