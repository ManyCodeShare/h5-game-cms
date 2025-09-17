const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { generateTokens, setCookies } = require('../utils/auth.utils');

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 注册新用户
exports.register = async (req, res, next) => {
  try {
    const { email, password, name, language, currency } = req.body;

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // 哈希密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        language: language || 'en',
        currency: currency || 'USD',
        consent: {
          create: {
            marketing: req.body.consent?.marketing || false,
            analytics: req.body.consent?.analytics || false,
            thirdParty: req.body.consent?.thirdParty || false
          }
        }
      },
      include: {
        consent: true
      }
    });

    // 生成令牌
    const { accessToken, refreshToken } = generateTokens(user);
    
    // 设置 cookies
    setCookies(res, accessToken, refreshToken);

    // 返回用户信息（不含密码）
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.status(201).json({
      user: userWithoutPassword,
      accessToken
    });
  } catch (error) {
    next(error);
  }
};

// 用户登录
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 更新最后登录时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // 生成令牌
    const { accessToken, refreshToken } = generateTokens(user);
    
    // 设置 cookies
    setCookies(res, accessToken, refreshToken);

    // 返回用户信息（不含密码）
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      accessToken
    });
  } catch (error) {
    next(error);
  }
};

// Google 登录
exports.googleLogin = async (req, res, next) => {
  try {
    const { token } = req.body;

    // 验证 Google 令牌
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ message: 'Invalid Google token' });
    }

    const { email, name, picture: avatar } = payload;

    // 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // 创建新用户
      user = await prisma.user.create({
        data: {
          email,
          name,
          avatar,
          passwordHash: '', // 社交登录不需要密码
          consent: {
            create: {
              marketing: false,
              analytics: true,
              thirdParty: true
            }
          }
        }
      });
    } else {
      // 更新用户信息
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          avatar,
          lastLogin: new Date()
        }
      });
    }

    // 生成令牌
    const { accessToken, refreshToken } = generateTokens(user);
    
    // 设置 cookies
    setCookies(res, accessToken, refreshToken);

    // 返回用户信息（不含密码）
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      accessToken
    });
  } catch (error) {
    next(error);
  }
};

// 登出
exports.logout = (req, res) => {
  // 清除 cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
};

// 刷新令牌
exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token not found' });
    }

    // 验证刷新令牌
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // 生成新令牌
    const tokens = generateTokens(user);
    
    // 设置新 cookies
    setCookies(res, tokens.accessToken, tokens.refreshToken);

    res.json({ accessToken: tokens.accessToken });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
};

// 获取当前用户信息
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { consent: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    next(error);
  }
};
