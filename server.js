const fs = require("fs");

const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');

const MAP_DIR = "images/";

/* Setup */
// setup server
const app = new Koa();
app.use(bodyParser());

const router = new Router();

// make sure map directory exists
fs.mkdirSync(MAP_DIR, 0o744, (err) => {
  if (err.code == 'EEXIST') return;
  
  throw err;
});

/* API Endpoints */
router.get("/maps", context => {
  // enumerate maps directory
  // generate array of maps
});

router.get("/maps/:map-id", context => {
  // read `${map-id}.png` from the map directory
  // set response type to 'image/png'
  // send image as response
});

router.post("/maps", context => {
  // receive image from request
  // find next available id
  // save image to disk
})

router.put("/maps/:map-id", context => {
  // receive image from rmequest
  // save image to `${map-id}.png`
});

router.delete("/maps/:map-id", context => {
  // delete image at `${map-id}.png`
});

/* Middleware */
// use koa-router
app.use(router.routes()).use(router.allowedMethods());

// log requests for debugging
app.use(async context => {
  console.log(`${context.request.method} ${context.request.url}`);
});

// handle errors on all requests
app.use(async (context, next) => {
  try {
    // attempt the request
    await next();
  } catch (err) {
    // on error, output status info
    context.status = err.status ?? 500;
    context.body = {
      error: err.message
    }
  }
});

/* Start Server */
const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}.`);
});
