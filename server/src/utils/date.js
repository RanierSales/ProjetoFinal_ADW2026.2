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

// Soma (ou subtrai) dias de uma data YYYY-MM-DD sem depender de fuso.
function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = { hoje, dataBR, addDays };
