const config = require('../config');

// "Hoje" no fuso de Roraima, no formato YYYY-MM-DD.
function hoje() {
  return new Date(Date.now() + config.tzOffsetHours * 3600 * 1000).toISOString().slice(0, 10);
}

function dataBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

module.exports = { hoje, dataBR };
