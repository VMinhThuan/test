const socketIO = require("socket.io");
const handleFriendEvents = require("../socketHandlers/friendHandler");
const handleChatEvents = require("../socketHandlers/chatHandler");
const handleReactionEvents = require("../socketHandlers/reactionHandler");
const handleUserStatusEvents = require("../socketHandlers/userStatusHandler");
const userService = require("../services/userService");

let io;
// Thời gian timeout cho mỗi người dùng (2 phút = 120000ms)
const ONLINE_TIMEOUT = 120000;

// Cơ chế kiểm tra người dùng nào đã offline
const startHeartbeatMonitoring = () => {
  setInterval(async () => {
    const now = Date.now();
    const usersToOffline = [];

    // Lấy danh sách heartbeat từ userStatusHandler
    const userHeartbeats = handleUserStatusEvents.getUserHeartbeats
      ? handleUserStatusEvents.getUserHeartbeats()
      : {};

    // Kiểm tra các người dùng đã quá thời gian timeout
    for (const userId in userHeartbeats) {
      const lastHeartbeat = userHeartbeats[userId];
      if (now - lastHeartbeat > ONLINE_TIMEOUT) {
        usersToOffline.push(userId);
      }
    }

    // Cập nhật trạng thái offline cho những người dùng đã timeout
    for (const userId of usersToOffline) {
      console.log(`User ${userId} timed out - marking as offline`);
      try {
        await userService.updateUserStatus(userId, {
          isOnline: false,
          lastActive: new Date().toISOString(),
        });

        // Thông báo cho tất cả người dùng
        if (io) {
          io.emit("user-status-change", {
            userId,
            status: "offline",
            lastActive: new Date().toISOString(),
          });
        }

        // Xóa khỏi tracking
        if (handleUserStatusEvents.getUserHeartbeats) {
          delete handleUserStatusEvents.getUserHeartbeats()[userId];
        }
      } catch (error) {
        console.error(`Error updating offline status for ${userId}:`, error);
      }
    }
  }, 30000); // Kiểm tra mỗi 30 giây
};

const initSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: [
        process.env.FRONTEND_URL || "http://localhost:3000", // Web local
        "http://localhost:8081", // React Native development server
        "http://10.0.2.2:8081", // Android emulator
        "http://10.0.2.2:3001", // Backend của máy 2
        "http://192.168.1.*:3001", // Cho phép kết nối từ mạng LAN
        "http://192.168.1.*:8081", // Cho phép kết nối từ mạng LAN
        "http://*:3000", // Cho phép web từ bất kỳ IP nào
        "http://*:8081", // Cho phép React Native từ bất kỳ IP nào
        "http://10.0.2.2:1111",
      ],
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    },
    pingTimeout: 120000, // 2 phút
    pingInterval: 60000, // 1 phút
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Lưu userId vào socket để quản lý
    const userId = socket.handshake.query.userId;
    if (userId) {
      socket.userId = userId;
      socket.join(`user_${userId}`);

      // Lưu thời gian heartbeat đầu tiên (sẽ được xử lý trong userStatusHandler)
    }

    // Đăng ký các handlers cho từng loại event
    handleFriendEvents(io, socket);
    handleChatEvents(socket, userId);
    handleReactionEvents(socket, userId);
    handleUserStatusEvents(socket);

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);

      // Nếu có userId, đánh dấu là offline ngay lập tức
      if (socket.userId) {
        const userId = socket.userId;

        // Delay 5 giây trước khi đánh dấu offline - đề phòng reconnect nhanh
        setTimeout(async () => {
          // Lấy danh sách heartbeat từ userStatusHandler
          const userHeartbeats = handleUserStatusEvents.getUserHeartbeats
            ? handleUserStatusEvents.getUserHeartbeats()
            : {};

          // Kiểm tra xem người dùng đã kết nối lại chưa
          if (
            !userHeartbeats[userId] ||
            Date.now() - userHeartbeats[userId] > 5000
          ) {
            try {
              await userService.updateUserStatus(userId, {
                isOnline: false,
                lastActive: new Date().toISOString(),
              });

              // Thông báo cho tất cả người dùng
              io.emit("user-status-change", {
                userId,
                status: "offline",
                lastActive: new Date().toISOString(),
              });

              // Xóa khỏi tracking
              if (handleUserStatusEvents.getUserHeartbeats) {
                delete handleUserStatusEvents.getUserHeartbeats()[userId];
              }
            } catch (error) {
              console.error(
                `Error updating offline status for ${userId}:`,
                error
              );
            }
          }
        }, 5000);
      }
    });
  });

  // Bắt đầu giám sát heartbeat
  startHeartbeatMonitoring();

  return io;
};

const getIO = () => {
  if (!io) {
    console.warn("Socket.IO not initialized yet, returning dummy emitter");
    // Trả về một đối tượng giả để tránh lỗi
    return {
      to: () => ({
        emit: () => console.log("Socket not initialized, message not sent"),
      }),
    };
  }
  return io;
};

// Hàm gửi thông báo đến một user cụ thể
const emitToUser = (userId, event, data) => {
  if (!io) {
    console.error("Socket.IO not initialized!");
    return;
  }
  io.to(`user_${userId}`).emit(event, data);
};

module.exports = {
  initSocket,
  getIO,
  emitToUser,
};
