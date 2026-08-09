const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/v1/ping', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`RelayAPI server listening on port ${PORT}`);
});
