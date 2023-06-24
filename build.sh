#! /usr/bin/env bash

# Uncomment below lines to print debug info
# export PS4="\$LINENO: "
# set -xv

mkdir dist dist/public dist/public/js dist/public/css dist/logs;

MAIN_JS=src/public/js/main.js; # temp file as entry point for rollup
MIN_JS=dist/bundle.min.js;
MIN_ADMIN_JS=dist/admin.min.js;
MIN_CSS=dist/bundle.min.css;
SRC_SERVER=src/server.js;

# Add import css statements to main.js needed for rollup
echo -n 'import "../css/style.css"
import "../css/sprite.css"
' > $MAIN_JS;

# Append app.js contents to main.js
# app.js is the main module for our frontend js
cat src/public/js/app.js >> $MAIN_JS;

# run rollup using config file
npx rollup -c;
npx rollup --config rollup.config-admin.mjs;

# Convert validate.js to commonjs for use in nodejs.
# Output the file to services folder
npx rollup --format cjs -o src/services/validate.js \
    src/public/js/validate.js/src/validate.js;

# remove the temp file
rm $MAIN_JS;

# rollup adds the css file next to js file
# move both files to their respective folders
mv $MIN_JS dist/public/js/bundle.min.js;
mv $MIN_ADMIN_JS dist/public/js/admin.min.js;
mv $MIN_CSS dist/public/css/bundle.min.css;

# copy minified css and js files to their respective folders in dist folder
cp -t dist/public/css/ src/public/css/bulma.min.css;

cp -t dist/public/js/ src/public/js/swipe.min.js \
    src/public/js/zxcvbn.min.js src/public/js/purify.min.js;

# copy images folder from src to dist folder
cp -t dist/public -a src/public/images/;

# copy other files and folders from src to dist folder
cp -t dist -a src/controllers/ src/middleware/ \
    src/model/ src/routes/ src/views src/services/;

cp -t dist src/appConfig.js package.json;

# Clean up any code marked for development from server.js

# -n silent mode,
# = to print current line number
START=$(sed -n '/START DEV CODE/=' $SRC_SERVER);
END=$(sed -n '/END DEV CODE/=' $SRC_SERVER);

# 10,12d - delete start and end lines and output to dist/server.js
sed "${START},${END}d" $SRC_SERVER > dist/server.js;

# check writeFile from fs module is used anywhere else in server.js

# grep -c : get count of writeFile occurences in server.js
LINE_NUM=$(grep -c "writeFile" dist/server.js);

# get the line number on which writeFile exists.
# This is likely the require statment
LINE=$(sed -n '/writeFile/=' dist/server.js);

# if LINE_NUM === 1 edit the file in place (sed -i) and delete the line
test $LINE_NUM -eq "1" && sed -i "${LINE}d" dist/server.js;
