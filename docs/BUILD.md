# An explanation of build.sh

This shell script generates a dist folder with bundled and minified javascript and css.

I have documented every line of code in build.sh and should be hopefully understandable if your familiar with linux command line.

Below are steps for everyone else.

1. Create the `dist` folder and other project folders
2. Create a temporary `src/public/js/main.js` file and append statements to import css files. This file is used by rollup to generate bundled css and js files.
3. Append the contents of `src/public/js/app.js` into `main.js`.
4. Run `rollup` with its default config file `rollup.config.mjs`. This outputs `dist/bundled.min.js` and `dist/bundled.min.css`
5. Run `rollup` to convert `src/public/js/validate.js/src/validate.js` to `cjs` format and output to `src/services/validate.js`
6. Run `rollup` with `rollup.config.admin.mjs` to generate `dist/admin.min.js`
7. Delete `main.js` and move the generated files to its respective folders in `dist`
8. Copy all other files in `src` to `dist` folder including the package.json in the project root.
9. Lastly remove some lines of code from `server.js` which are not required in production. I used a combination of `sed` and `grep` commands to achieve it.
