const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

let io = null;

// Tempo real (bônus): admins recebem "nova solicitação"; fornecedor recebe "decisão".
function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: config.clientUrl, credentials: true } });

  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, config.jwtSecret);
      const user = await User.findById(payload.sub);
      if (!user || !user.ativo) throw new Error('inativo');
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Não autorizado'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.data.user;
    if (u.role === 'admin') socket.join('admins');
    else socket.join(`fornecedor:${u.fornecedor}`);
  });

  return io;
}

const emitToAdmins = (evento, payload) => io && io.to('admins').emit(evento, payload);
const emitToFornecedor = (id, evento, payload) => io && io.to(`fornecedor:${id}`).emit(evento, payload);

module.exports = { initSocket, emitToAdmins, emitToFornecedor };
