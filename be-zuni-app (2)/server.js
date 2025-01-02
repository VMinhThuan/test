require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const initRoutes = require("./routes");
const errorHandler = require("./middlewares/errorHandler");
const { initSocket } = require("./configs/socket");

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "delay"],
    exposedHeaders: ["set-cookie"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

initRoutes(app);
app.use(errorHandler);

initSocket(server);

const PORT = process.env.PORT || 3001;

// Khởi động server và test kết nối
server.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
