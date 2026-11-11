const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const AppError = require('./utils/AppError');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '100kb' }));

app.use('/api', routes);
app.use((_req, _res, next) => next(new AppError(404, 'Rota não encontrada')));
app.use(errorHandler);

module.exports = app;
