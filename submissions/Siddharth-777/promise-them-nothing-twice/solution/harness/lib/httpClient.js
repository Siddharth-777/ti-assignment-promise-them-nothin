const https = require('https');
const fs = require('fs');
const path = require('path');

const CA_CERT = fs.readFileSync(
  path.join(__dirname, '..', '..', 'certs', 'server.crt')
);

function sendRequest(port, customerId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port,
      path: '/api/v1/ping',
      method: 'GET',
      headers: {},
      ca: CA_CERT,
    };

    if (customerId !== undefined && customerId !== null) {
      options.headers['X-Customer-Id'] = customerId;
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

module.exports = { sendRequest };
