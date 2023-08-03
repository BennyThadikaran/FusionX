#! /usr/bin/env bash

# Uncomment below lines to print debug info
# export PS4="\$LINENO: "
# set -xv

# create the dist folder and other folders within
mkdir dist dist/public dist/public/js dist/public/css dist/public/images;

MAIN_JS=src/public/js/bundle.min.js; # temp file as entry point for rollup
SRC_SERVER=src/server.js;

# Add import css statements to main.js needed for rollup to generate bundle
echo -n 'import "../css/style.css"
import "../css/sprite.css"
' > $MAIN_JS;

exec node <<EOF
const { writeFile } = require("fs");
const config = require("./src/appConfig.js");

writeFile(
  "./src/public/js/variables.js",
  \`export const imgUrl = "\${config.imgUrl}";
export const shopListLimit = \${config.shopListLimit};
export const blogListLimit = \${config.blogListLimit};
export const commentListLimit = \${config.commentListLimit};\`,
  (err) => {
    if (err) throw err;
  }
);
EOF

# Append app.js contents to main.js
# app.js is the main module for our frontend js
cat src/public/js/app.js >> $MAIN_JS;

# create a copy of admin.js and name it admin.min.js
# this is only to provide consistent naming to the rollup output files
# it will be deleted later
cp src/public/js/admin.js src/public/js/admin.min.js

# run rollup using config file
npx rollup -c;

# Convert validate.js to commonjs for use in nodejs. Output the file to
# services folder. We could use UMD format but i prefer separation of
# backend and frontend js files.
# for umd format use: --name 'validate' --format umd
npx rollup --format cjs -o src/services/validate.js \
    src/public/js/validate.js/src/validate.js;

# rollup work completed, remove the temp file
rm $MAIN_JS src/public/js/admin.min.js;

# rollup outputs all files in the dist folder.
# Perhaps the behavior can be changed in config?
# move all files to their respective folders

# gzip, brotli js and js.map files to dist/public/js
mv -t dist/public/js/ dist/*.js.br dist/*.js.gz dist/*.js.map

# gzip, brotli css files to dist/public/css
mv -t dist/public/css dist/*.css.gz dist/*.css.br

# gzip, brotli png, svg, ico files to dist/public/images
mv -t dist/public/images \
    dist/*.png.br dist/*.png.gz dist/*.ico.br dist/*.ico.gz dist/*.svg.br \
    dist/*.svg.gz

# move remaining files brotli and gzip files to dist/public
# these are browserconfig.xml, manifest.json and their gzip and brotli files
mv -t dist/public dist/*.br dist/*.gz

# all other static files are removed
rm dist/*.js dist/*.css dist/*.png dist/*.ico dist/*.svg dist/*.json dist/*.xml

# copy other files and folders from src to dist folder
cp -t dist -a src/controllers/ src/middleware/ \
    src/model/ src/routes/ src/views src/services/;

cp -t dist src/appConfig.js package.json;

# Clean up any code marked for development from server.js
# sed: -n silent mode, = to print current line number
START=$(sed -n '/START DEV CODE/=' $SRC_SERVER);
END=$(sed -n '/END DEV CODE/=' $SRC_SERVER);

# sed: 10,12d - delete start and end lines and output to dist/server.js
sed "${START},${END}d" $SRC_SERVER > dist/server.js;

# check if writeFile from fs module is used anywhere else in server.js
# grep -c : get count of writeFile occurences in server.js
LINE_NUM=$(grep -c "writeFile" dist/server.js);

# get the line number on which writeFile exists.
# This is likely the require statement
LINE=$(sed -n '/writeFile/=' dist/server.js);

# if LINE_NUM === 1 edit the file in place (sed -i) and delete the line
test $LINE_NUM -eq "1" && sed -i "${LINE}d" dist/server.js;
