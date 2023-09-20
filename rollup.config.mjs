import terser from "@rollup/plugin-terser";
import postcss from "rollup-plugin-postcss";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import gzipPlugin from "rollup-plugin-gzip";
import { brotliCompress, constants } from "zlib";
import copy from "rollup-plugin-copy";
import { readdirSync } from "fs";
import { promisify } from "util";

let additionalFiles = readdirSync("src/public/images")
  .filter((fn) => {
    return fn.match(/.(png|svg|ico)$/);
  })
  .map((file) => `dist/${file}`);

additionalFiles = additionalFiles.concat([
  "dist/bulma.min.css",
  "dist/swipe.min.js",
  "dist/purify.min.js",
  "dist/zxcvbn.min.js",
  "dist/browserconfig.xml",
  "dist/manifest.json",
]);

const brotliPromise = promisify(brotliCompress);
const gzipFilter = /.(js|css|png|svg|ico|xml|json)$/;

export default {
  input: ["./src/public/js/bundle.js", "./src/public/js/admin.js"],
  output: {
    sourcemap: true,
    dir: "dist",
    format: "es",
    entryFileNames: "[hash].[name].min.js",
    generatedCode: {
      constBindings: true,
    },
    plugins: [
      terser({ sourceMap: true }),
      gzipPlugin({
        filter: gzipFilter,
        gzipOptions: { level: constants.Z_BEST_COMPRESSION },
        additionalFiles,
      }),
      gzipPlugin({
        customCompression: (content) => brotliPromise(Buffer.from(content)),
        fileName: ".br",
        additionalFiles,
      }),
    ],
  },
  plugins: [
    postcss({
      extract: true,
      minimize: true,
      sourceMap: false,
      plugins: [autoprefixer(), cssnano()],
    }),
    copy({
      targets: [
        {
          src: [
            "src/public/images/*",
            "src/public/js/swipe.min.js",
            "src/public/js/purify.min.js",
            "src/public/js/zxcvbn.min.js",
            "src/public/css/bulma.min.css",
            "src/public/browserconfig.xml",
            "src/public/manifest.json",
          ],
          dest: "dist",
        },
      ],
    }),
  ],
};
