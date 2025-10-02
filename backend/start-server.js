const { spawn } = require('child_process');

console.log('🚀 Starting DocsShare server...');

const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

server.on('close', (code) => {
  if (code !== 0) {
    console.log(`\n❌ Server exited with code ${code}`);
  } else {
    console.log('\n✅ Server shut down gracefully');
  }
});

process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down server...');
  server.kill('SIGTERM');
});