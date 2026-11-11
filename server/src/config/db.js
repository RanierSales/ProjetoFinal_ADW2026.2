const mongoose = require('mongoose');
const config = require('./index');

module.exports = async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri);
  console.log('[db] MongoDB conectado');
};
