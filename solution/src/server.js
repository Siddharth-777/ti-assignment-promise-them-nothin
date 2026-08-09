const express = require('express');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/v1/ping', rateLimiter, (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`RelayAPI server listening on port ${PORT}`);
});
