const http = require('http');
const config = require('./config');
const connectDB = require('./config/db');
const app = require('./app');
const { initSocket } = require('./services/socket');

async function main() {
  if (!config.jwtSecret) {
    console.error('Defina JWT_SECRET no arquivo .env (veja .env.example).');
    process.exit(1);
  }
  await connectDB();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(config.port, () => console.log(`[api] http://localhost:${config.port}/api`));
}

main().catch((err) => {
  console.error('Falha ao iniciar:', err.message);
  process.exit(1);
});
