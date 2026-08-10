const PORTS = [3001, 3002, 3003];

function pickRandomPort() {
  return PORTS[Math.floor(Math.random() * PORTS.length)];
}

module.exports = { pickRandomPort, PORTS };
