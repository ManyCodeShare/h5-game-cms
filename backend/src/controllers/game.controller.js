const { PrismaClient } = require('@prisma/client');
const { uploadToStorage } = require('../utils/storage.utils');
const { validateGameData } = require('../utils/validation.utils');

const prisma = new PrismaClient();

// 获取所有游戏
exports.getAllGames = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      genre, 
      published 
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    
    // 构建查询条件
    const where = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (genre) {
      where.genre = { has: genre };
    }
    
    if (published !== undefined) {
      where.isPublished = published === 'true';
    }

    // 查询游戏
    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where,
        include: {
          currentVersion: true
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.game.count({ where })
    ]);

    res.json({
      games,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

// 获取单个游戏详情
exports.getGameById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' }
        },
        currentVersion: true,
        virtualItems: true,
        events: {
          where: {
            OR: [
              { isActive: true },
              { endDate: { gte: new Date() } }
            ]
          }
        }
      }
    });

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    next(error);
  }
};

// 创建新游戏
exports.createGame = async (req, res, next) => {
  try {
    const gameData = req.body;
    
    // 验证游戏数据
    const validation = validateGameData(gameData);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    // 处理缩略图上传
    let thumbnailUrl = null;
    if (req.files && req.files.thumbnail) {
      const thumbnail = req.files.thumbnail;
      thumbnailUrl = await uploadToStorage(thumbnail, `games/${gameData.slug}/thumbnails`);
    }

    // 创建游戏
    const game = await prisma.game.create({
      data: {
        ...gameData,
        thumbnail: thumbnailUrl
      }
    });

    res.status(201).json(game);
  } catch (error) {
    next(error);
  }
};

// 更新游戏信息
exports.updateGame = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 检查游戏是否存在
    const existingGame = await prisma.game.findUnique({
      where: { id }
    });

    if (!existingGame) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // 处理缩略图上传（如果有）
    let thumbnailUrl = existingGame.thumbnail;
    if (req.files && req.files.thumbnail) {
      const thumbnail = req.files.thumbnail;
      thumbnailUrl = await uploadToStorage(thumbnail, `games/${existingGame.slug}/thumbnails`);
    }

    // 更新游戏
    const updatedGame = await prisma.game.update({
      where: { id },
      data: {
        ...updateData,
        ...(thumbnailUrl && { thumbnail: thumbnailUrl })
      }
    });

    res.json(updatedGame);
  } catch (error) {
    next(error);
  }
};

// 发布/取消发布游戏
exports.togglePublish = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { publish } = req.body;

    // 检查游戏是否存在
    const game = await prisma.game.findUnique({
      where: { id },
      include: { currentVersion: true }
    });

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // 检查是否有可用版本
    if (publish && !game.currentVersion) {
      return res.status(400).json({ 
        message: 'Cannot publish game without a current version' 
      });
    }

    // 更新发布状态
    const updatedGame = await prisma.game.update({
      where: { id },
      data: {
        isPublished: publish,
        publishedAt: publish ? new Date() : null
      }
    });

    res.json(updatedGame);
  } catch (error) {
    next(error);
  }
};

// 删除游戏
exports.deleteGame = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 检查游戏是否存在
    const game = await prisma.game.findUnique({
      where: { id }
    });

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // 删除游戏（级联删除相关数据）
    await prisma.game.delete({
      where: { id }
    });

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// 获取游戏的统计数据
exports.getGameStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { period = '7d' } = req.query;

    // 计算日期范围
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // 获取游戏统计数据
    const [
      totalPlayers,
      totalSessions,
      averageSessionDuration,
      dailyActiveUsers,
      revenue,
      topItems
    ] = await Promise.all([
      // 总玩家数
      prisma.gameSession.aggregate({
        _count: { userId: true },
        where: {
          gameId: id,
          startTime: { gte: startDate, lte: endDate }
        },
        _distinct: ['userId']
      }),
      
      // 总会话数
      prisma.gameSession.count({
        where: {
          gameId: id,
          startTime: { gte: startDate, lte: endDate }
        }
      }),
      
      // 平均会话时长（分钟）
      prisma.$queryRaw`
        SELECT AVG(EXTRACT(EPOCH FROM (endTime - startTime))/60) as avg_duration
        FROM "GameSession"
        WHERE "gameId" = ${id}
        AND "startTime" >= ${startDate}
        AND "endTime" IS NOT NULL
      `,
      
      // 日活跃用户
      prisma.$queryRaw`
        SELECT DATE_TRUNC('day', "startTime") as day, COUNT(DISTINCT "userId") as dau
        FROM "GameSession"
        WHERE "gameId" = ${id}
        AND "startTime" >= ${startDate}
        AND "startTime" <= ${endDate}
        GROUP BY day
        ORDER BY day
      `,
      
      // 总收入
      prisma.purchase.aggregate({
        _sum: { amount: true },
        where: {
          item: { gameId: id },
          status: 'COMPLETED',
          createdAt: { gte: startDate, lte: endDate }
        }
      }),
      
      // 热销物品
      prisma.purchase.aggregate({
        _count: { id: true },
        _sum: { amount: true },
        where: {
          item: { gameId: id },
          status: 'COMPLETED',
          createdAt: { gte: startDate, lte: endDate }
        },
        by: ['itemId'],
        orderBy: { _sum: { amount: 'desc' } },
        take: 5
      })
    ]);

    res.json({
      totalPlayers: totalPlayers._distinct.userId,
      totalSessions,
      averageSessionDuration: averageSessionDuration[0]?.avg_duration || 0,
      dailyActiveUsers,
      totalRevenue: revenue._sum.amount || 0,
      topItems: await Promise.all(
        topItems.map(async item => {
          const virtualItem = await prisma.virtualItem.findUnique({
            where: { id: item.itemId }
          });
          return {
            ...item,
            item: virtualItem
          };
        })
      )
    });
  } catch (error) {
    next(error);
  }
};
