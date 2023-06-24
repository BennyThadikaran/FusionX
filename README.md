# FusionX

## An E-Commerce website built using Node.js, MongoDb, Express.

The Frontend is built on pure vanilla javascript and [Bulma css framework](https://bulma.io/).

Project deployed live at: **https://worrisome-scrubs-toad.cyclic.app/**

**Admin User login:**

- email: rob.test@example.com
- password: robtester@

**Collab User login:**

- Collaborator responsible for generating blog content
- email: bob.test@example.com
- password: bobtester@

**Customer login**

- email: john.test@example.com
- password: johntester@

**The project consists of:**

- Shop with attribute filters and multiple item variants.
- Cart and Checkout system with guest order support.
- Blog system with listing by tags and author.
- Comment system (Single thread) with reply, edit
- Authenthication system
- Customer profile
  - Order listing
  - View Order details
  - Edit Address or Set default billing address
  - Change password
- Admin system with custom roles
  - Create a user with assigned role
  - Create a Blog Post
- Server side and Client side caching using node-cache and localStorage
- Python scripts to bulk upload product listings using TSV templates files.

## Usage

Clone the repo along with its submodules

```bash
git clone --recurse-submodules https://github.com/BennyThadikaran/FusionX.git
```

Install the dependencies

```bash
cd FusionX;
npm install
```

Create a `.env` file in the `src` folder and add the `SESSION_SECRET`, `STORE_SECRET`, `MONGO_CONN_STRING`, `DOMAIN_NAME`
```
SESSION_SECRET=<YOUR SESSION SECRET>
STORE_SECRET=<YOUR STORE SECRET>
MONGO_CONN_STRING=<YOUR MONGO CONNECTION STRING>
DOMAIN_NAME=http://localhost:3000
```
**To generate the secret**, start a repl session in node and run:

```javascript
require("crypto").randomBytes(64).toString("hex");
```

`DOMAIN_NAME` is used to set CORS headers and can be left as above.

**To start a development server with nodemon**

```bash
npm run dev
```

**To start a production server with bundled and minified javascript and css**

```bash
# Make build.sh executable
chmod +x build.sh

# Run build.sh
./build.sh

# Copy .env to dist folder - ONLY REQUIRED WHEN RUNNING LOCALLY
cp src/.env dist/

# Start a production server
npm run start
```

`npm run build` is only meant for automated deployment to actual servers.

It adds an extra step `git submodule update --init` to pull and update the submodules prior to executing `build.sh`

[An explanation of build.sh](docs/BUILD.md)

[Security Features in FusionX](docs/SECURITY.md)

[Missing Features in FusionX and TODO list](docs/TODO.md)
