#! /usr/bin/env bash

# Uncomment below lines to print debug info
# export PS4="\$LINENO: "
# set -xv

# create the dist folder and other folders within
mkdir -p dist dist/public dist/public/js dist/public/css dist/public/images;

MAIN_JS=src/public/js/bundle.js; # temp file as entry point for rollup
SRC_SERVER=src/server.js;

# Add import css statements to main.js needed for rollup to generate bundle
echo -n 'import "../css/style.css"
import "../css/sprite.css"
' > $MAIN_JS;

# execute nodejs code
# Store variables from config to variables.js
# Test env variables differ from dev/prod variables. In test/dev environment,
# variables are written to variables.js everytime servers is restarted.
# Below code ensures test variables don't leak into production
$(exec node <<EOF
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
);

# Append app.js contents to bundle.js
# app.js is the main module for our frontend js
cat src/public/js/app.js >> $MAIN_JS;

# run rollup using config file
npx rollup -c;

# Convert validate.js to commonjs for use in nodejs. Output the file to
# services folder. We could use UMD format but i prefer separation of
# backend and frontend js files.
# for umd format use: --name 'validate' --format umd
npx rollup --format cjs -o src/services/validate.js \
    src/public/js/validate.js/src/validate.js;

# rollup work completed, remove the temp file
rm $MAIN_JS;

# rollup will output all files in the dist folder. Move all files to their respective folders

# Compressed JS and related souremaps to dist/public/js
mv -t dist/public/js/ dist/*.js.br dist/*.js.gz dist/*.js.map

# Compressed css files to dist/public/css
mv -t dist/public/css dist/*.css.gz dist/*.css.br

# Compressed png, svg, ico files to dist/public/images
mv -t dist/public/images \
    dist/*.png.br dist/*.png.gz dist/*.ico.br dist/*.ico.gz dist/*.svg.br \
    dist/*.svg.gz

# move remaining compressed files to dist/public - browserconfig.xml, manifest.json
mv -t dist/public dist/*.br dist/*.gz

# remove all other non compressed static files
rm dist/*.js dist/*.css dist/*.png dist/*.ico dist/*.svg dist/*.json dist/*.xml

# copy remaining files and folders from src to dist folder
cp -t dist -a src/controllers/ src/middleware/ \
    src/model/ src/routes/ src/views src/services/;

cp -t dist src/appConfig.js package.json;

# Rollup bundles css with filename [hash].admin.min.css instead of bundled.min.css
# Need to check with Rollup team, meanwhile lets rename the files
# Get the hashed filename for gzip and brotli
GZ_FILE=$(ls dist/public/css/*.admin.min.css.gz)
BR_FILE=${GZ_FILE/gz/br}

# If file exists, rename them correctly as
# [hash].bundle.css.gz and [hash].bundle.css.br
test -f $GZ_FILE && mv $GZ_FILE ${GZ_FILE/admin/bundle}
test -f $BR_FILE && mv $BR_FILE ${BR_FILE/admin/bundle}

# get the base file name and strip out .gz
JS=$(basename dist/public/js/*.bundle.min.js.gz | sed 's/.gz//');
CSS=$(basename dist/public/css/*.bundle.min.css.gz | sed 's/.gz//')

# replace the script src to reflect the hash js filename
sed -i "s/bundle.min.js/${JS}/g" dist/views/partials/footer.ejs

# replace the stylesheet href to reflect the hashed css filename
sed -i "s/bundle.min.css/${CSS}/g" dist/views/partials/head.ejs

# Clean up any code marked for development from server.js
# sed: -n silent mode, = to print current line number
START=$(sed -n '/START DEV CODE/=' $SRC_SERVER);
END=$(sed -n '/END DEV CODE/=' $SRC_SERVER);

# sed: 10,12d - delete lines numbered from $START to $END and output to dist/server.js
sed "${START},${END}d" $SRC_SERVER > dist/server.js;

# check if writeFile from fs module is used anywhere else in server.js
# grep -c : get count of writeFile occurences in server.js
LINE_COUNT=$(grep -c "writeFile" dist/server.js);

# get the line number on which writeFile exists.
# This is likely the require statement
LINE=$(sed -n '/writeFile/=' dist/server.js);

# if LINE_NUM === 1 edit the file in place (sed -i) and delete the line
test $LINE_COUNT -eq "1" && sed -i "${LINE}d" dist/server.js;
