const fs = require('fs');

const Koa = require('koa');
const Router = require('@koa/router');
const multer = require('@koa/multer');
const cors = require('@koa/cors')

const MAPS_DIR = __dirname + '\\public\\images\\';
const MAPS_TYPES = {
  png: "image/png",
  jpeg: "image/jpeg", jpg: "image/jpeg",
};

const r_filename = /([^\\//]+)\.(.+)$/;

/* Setup */
// setup server
const app = new Koa();
const router = new Router();

// setup multer for uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: MAPS_DIR,
    filename: (req, file, cb) => {
      const parts = file.originalname.match(r_filename);
      cb(null, `${(req.body.name ?? parts[1])}.${parts[2]}`);
    },
  })
});

/* Error Types */
class MapFileError extends Error {
  constructor(message) {
    super(message);
    this.name = "MapFileError";
  }
}

/* Map Object */
class Map {
  constructor(filename) {
    this.source = MAPS_DIR + filename;

    const parts = filename.match(r_filename);

    // return null on constructor fail
    if (!parts)
      throw new MapFileError(`Malformed filename`);

    this.name = parts[1];

    if (!MAPS_TYPES[parts[2]])
      throw new MapFileError(`Invalid file extension .${match[2]}`);

    this.type = MAPS_TYPES[parts[2]];
  }
}

// enumerate maps on startup
console.log(`Enumerating maps directory "${MAPS_DIR}"...`);

const maps = fs.readdirSync(MAPS_DIR)
  .reduce((acc, file) => {
    try {
      acc.push(new Map(file));
    } catch (error) {
      console.log(`Failed to load map, "${MAPS_DIR + file}": ${error.message}!`);
    }

    return acc;
  }, []);

console.log("Done.\n");

/* API Endpoints */
router.get('/maps', async context => {
  context.type = 'application/json';
  context.body = maps;

  await next();
});

router.get('/maps/:id', async context => {
  const map = maps.find(map => (map.name === context.params.id));

  if (map) {
    context.type = 'application/json';
    context.body = map;
  } else {
    context.status = 404;
    context.body = { error: 'Map not found' }
  }

  await next();
});

router.get('/maps/:id/image', async context => {
  const map = maps.find(map => (map.name === context.params.id));

  // read map image from disk
  context.type = map.type;
  context.body = fs.createReadStream(map.source);

  await next();
});

router.post('/maps', upload.single('image'), context => {
  // image saved to disk, notify requester
  context.body = 'Done.';
  context.status = 200;
  
  // receive image from request
  // find next available id
  // save image to disk
}, (err, context) => {
  // image failed to save, notify requester
  context.status = 400;
  context.body = err.message;
});

router.put('/maps/:id', context => {
  // receive image from request
  // save image to `${map-id}.png`
});

router.delete('/maps/:id', context => {
  // delete image at `${map-id}.png`
});

/* Middleware */
// log all requests for debugging
app.use(async (context, next) => {
  console.log(`${context.method} ${context.url}`);
  await next();
});

// handle errors on all requests
app.use(async (context, next) => {
  try {
    // attempt the request
    await next();
  } catch (error) {
    // on error, output status info
    context.status = error.status ?? 500;
    context.body = {
      error: error.message
    }
  }
});

// koa middleware
app.use(cors())
  .use(router.routes())
  .use(router.allowedMethods());

/* Start Server */
const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}.`);
});