const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

// 导入路由
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const gameRoutes = require('./routes/game.routes');
const versionRoutes = require('./routes/version.routes');
const itemRoutes = require('./routes/item.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const eventRoutes = require('./routes/event.routes');

// 导入中间件
const { errorHandler } = require('./middleware/error.middleware');
const { authenticate } = require('./middleware/auth.middleware');
const { checkRole } = require('./middleware/role.middleware');

const app = express();
const prisma = new PrismaClient();

// 全局中间件
app.use(helmet()); // 安全头部
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// 限流
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP限制请求数
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// 路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 公开路由
app.use('/api/auth', authRoutes);

// 需要认证的路由
app.use('/api/users', authenticate, userRoutes);
app.use('/api/games', authenticate, gameRoutes);
app.use('/api/versions', authenticate, versionRoutes);
app.use('/api/items', authenticate, itemRoutes);
app.use('/api/purchases', authenticate, purchaseRoutes);
app.use('/api/events', authenticate, eventRoutes);

// 管理员路由
app.use('/api/analytics', authenticate, checkRole(['ADMIN', 'OPERATOR']), analyticsRoutes);

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // 在生产环境中，可能需要优雅地关闭服务
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;
