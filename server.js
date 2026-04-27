require('dotenv').config();
require('./src/config/db'); // initialise pool on startup

const app  = require('./src/app');
const PORT = parseInt(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Content Broadcasting System`);
  console.log(`   Listening on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health:      http://localhost:${PORT}/health\n`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n${signal} received — shutting down gracefully`);
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
