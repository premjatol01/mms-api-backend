const { Server } = require("socket.io");

let io = null;

/**
 * Initializes Socket.io with the given HTTP server instance.
 */
function initSocket(server) {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
    : [];

  io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          origin.includes("localhost:") ||
          (process.env.BASE_DOMAIN &&
            origin.includes(process.env.BASE_DOMAIN.split(":")[0]))
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    // -------------------------------------------------------------
    // Restaurant Room: Joined by restaurant staff & admin dashboard
    // -------------------------------------------------------------
    socket.on("join_restaurant", (restaurantId) => {
      if (!restaurantId) return;
      const room = `restaurant:${String(restaurantId)}`;
      socket.join(room);
    });

    socket.on("leave_restaurant", (restaurantId) => {
      if (!restaurantId) return;
      const room = `restaurant:${String(restaurantId)}`;
      socket.leave(room);
    });

    // -------------------------------------------------------------
    // Table Room: Joined by customer web ordering portal on QR scan
    // -------------------------------------------------------------
    socket.on("join_table", ({ restaurantId, tableId } = {}) => {
      if (!tableId) return;
      const room = `table:${String(tableId)}`;
      socket.join(room);
    });

    socket.on("leave_table", (tableId) => {
      if (!tableId) return;
      const room = `table:${String(tableId)}`;
      socket.leave(room);
    });

    socket.on("disconnect", () => {
      // Disconnection handled automatically by socket.io
    });
  });

  return io;
}

/**
 * Returns the current Socket.io server instance.
 */
function getIO() {
  if (!io) {
    console.warn("Socket.io not yet initialized!");
  }
  return io;
}

/**
 * Emits an event to all sockets in a restaurant room (admin/staff).
 */
function emitToRestaurant(restaurantId, event, data) {
  if (!io || !restaurantId) return;
  io.to(`restaurant:${String(restaurantId)}`).emit(event, data);
}

/**
 * Emits an event to all customer sockets at a specific table.
 */
function emitToTable(tableId, event, data) {
  if (!io || !tableId) return;
  io.to(`table:${String(tableId)}`).emit(event, data);
}

/**
 * Emits an event to both the restaurant room and the specific table room.
 */
function emitToTableAndRestaurant({ restaurantId, tableId, event, data }) {
  if (!io) return;
  if (restaurantId) {
    io.to(`restaurant:${String(restaurantId)}`).emit(event, data);
  }
  if (tableId) {
    io.to(`table:${String(tableId)}`).emit(event, data);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitToRestaurant,
  emitToTable,
  emitToTableAndRestaurant,
};
