const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;

const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server.crt')),
};

app.get('/api/v1/ping', rateLimiter, (req, res) => {
  res.json({ status: 'ok' });
});

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`RelayAPI server listening on port ${PORT} (HTTPS)`);
});
