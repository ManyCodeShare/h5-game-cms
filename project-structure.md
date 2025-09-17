# 海外H5游戏CMS系统项目结构
h5-game-cms/
├── backend/                  # 后端服务
│   ├── src/
│   │   ├── config/           # 配置文件
│   │   ├── controllers/      # 控制器
│   │   ├── middleware/       # 中间件
│   │   ├── models/           # 数据模型
│   │   ├── routes/           # 路由定义
│   │   ├── services/         # 业务逻辑
│   │   ├── utils/            # 工具函数
│   │   └── app.js            # 应用入口
│   ├── .env.example          # 环境变量示例
│   └── package.json
│
├── frontend/                 # 前端应用
│   ├── public/
│   ├── src/
│   │   ├── assets/           # 静态资源
│   │   ├── components/       # 组件
│   │   ├── contexts/         # 上下文
│   │   ├── hooks/            # 自定义钩子
│   │   ├── i18n/             # 多语言支持
│   │   ├── pages/            # 页面
│   │   ├── services/         # API服务
│   │   ├── utils/            # 工具函数
│   │   └── App.js            # 应用入口
│   └── package.json
│
├── docker-compose.yml        # Docker配置
└── README.md                 # 项目说明