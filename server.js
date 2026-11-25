'use strict';
// Load .env if present (Node 21.7+ built-in, no dotenv needed).
try {
  process.loadEnvFile();
} catch {
  /* no .env file */
}

const http = require('node:http');
const { createApp } = require('./src/app');
const config = require('./src/config');

const app = createApp();
const server = http.createServer(app.handler);

server.listen(config.port, config.host, () => {
  console.log(`${config.site.name} website running at http://localhost:${config.port}`);
  console.log(`Admin panel: http://localhost:${config.port}/admin`);
});

function shutdown() {
  server.close(() => {
    app.db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
