const fs = require('fs');
const slugify = require('slugify')

const Koa = require('koa');
const Router = require('@koa/router');
const multer = require('@koa/multer');
const cors = require('@koa/cors')

// file management
const MAPS_DIR = __dirname + '/public/images/';

// maps accepted MIME types to specific file extensions
const FILE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
};

// regex
const r_filename = /([^\\//]+)\.(.+)$/;

/* Setup */
// setup server
const app = new Koa();
const router = new Router();

// load map data
let maps = {};

try {
  maps = fs.readFileSync('maps.json', 'utf8');
} catch (error) {
  if (error.code == 'ENOENT')
    console.log('No existing maps directory.');
  else
    throw error;
}

// setup multer for uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: MAPS_DIR,
    filename: (req, file, cb) => {
      const parts = file.originalname.match(r_filename);

      // get name and id with defaults
      const id = slugify(req.body.id ?? parts[1]).toLowerCase();
      const name = req.body.name ?? id;
      const ext = FILE_TYPES[file.mimetype];

      // check for existing id
      const old_map = maps[id]?.image.filename;

      // create map object
      maps[id] = {
        id: id,
        name: name,
        image: {
          filename: `${id}.${ext}`,
          path: `/maps/${id}/`
        }
      };

      // write image to disk
      cb(null, `${id}.${ext}`);

      // update map directory
      fs.writeFile('maps.json', JSON.stringify(maps), 'utf8', (err) => {
        if (err)
          throw err;
      });

      // remove old map image if not overwritten
      if (old_map && old_map != maps[id].image.filename)
        console.log("UNLINK", old_map);
        //fs.unlinkSync(MAPS_DIR + old_map);
    },
  })
});

/* API Endpoints */
router.get('/maps', async (context, next) => {
  context.type = 'application/json';
  context.body = maps;

  await next();
});

router.get('/maps/:id', async (context, next) => {
  const map = maps.find(map => (map.id === context.params.id));

  if (map) {
    context.type = 'application/json';
    context.body = map;
  } else {
    context.status = 404;
    context.body = { error: 'Map not found' }
  }

  await next();
});

router.get('/maps/:id/image', async (context, next) => {
  const map = maps.find(map => (map.name === context.params.id));

  // read map image from disk
  context.type = map.type;
  context.body = fs.createReadStream(map.source);

  await next();
});

// todo: add endpoints to query and update screen mappings
// GET /screens/ ?

router.post('/maps', upload.single('image'), async (context, next) => {
  context.body = 'Done.';
  context.status = 200;

  await next();
}, (error, context) => {
  // image failed to save, notify requester
  context.status = 400;
  context.body = error.message;
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