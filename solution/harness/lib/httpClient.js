const http = require('http');

function sendRequest(port, customerId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port,
      path: '/api/v1/ping',
      method: 'GET',
      headers: {},
    };

    if (customerId !== undefined && customerId !== null) {
      options.headers['X-Customer-Id'] = customerId;
    }

    const req = http.request(options, (res) => {
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
