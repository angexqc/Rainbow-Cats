# Rainbow Cats 微信小程序

情侣点餐小程序前端，当前主线使用原生微信小程序页面 + Node API 后端，不再包含微信云开发云函数和旧版任务/商城/积分页面。

## 当前架构

- 小程序主代码：`miniprogram/`
- 页面目录：`miniprogram/pages/`
- 统一数据访问：`miniprogram/utils/apiStore.js`
- 接口封装：`miniprogram/services/*.js`
- 默认后端：`https://wubaihappyfood.top/api`
- 本地后端：`http://127.0.0.1:3100/api`

调用链路：

```text
pages/* -> utils/apiStore.js -> services/*.js -> services/http.js -> Node API /api/*
```

网络不可用或后端 5xx 时，`apiStore` 会按场景回退到本地 `mockStore`，便于开发和演示。

## 功能模块

- 启动页与资料初始化。
- 微信登录、JWT 会话、登录失效处理。
- 首页轮播、最受欢迎菜品、菜品排行榜。
- 情侣配对、配对码生成、绑定、解绑。
- 菜单列表、搜索、分类筛选、菜品新增/编辑/上下架/删除。
- 菜单分类新增、编辑、删除、排序。
- 点单车、随机转盘、订单确认。
- 订单列表、订单详情、状态流转、点赞和评价。
- 订阅通知设置、微信身份绑定、测试通知。
- 图片上传：菜品图、轮播图、头像。

## 后端部署

后端项目位于仓库根目录的 `node-api/`。

本地启动：

```bash
cd ../node-api
npm install
cp .env.example .env
npm run dev
```

Docker 部署：

```bash
cd ../node-api
cp .env.example .env
docker compose --env-file .env up -d --build
```

Ubuntu 24.04 全流程部署见：

```text
../node-api/docs/ubuntu-24-docker-deploy.md
```

## 小程序接口地址

默认接口地址在 `miniprogram/app.js`：

```js
const DEFAULT_API_BASE_URL = 'https://wubaihappyfood.top/api'
```

本地调试可在微信开发者工具控制台设置：

```js
wx.setStorageSync('apiBaseUrl', 'http://127.0.0.1:3100/api')
```

生产环境建议配置 HTTPS 域名：

```js
wx.setStorageSync('apiBaseUrl', 'https://api.example.com/api')
```

并在微信小程序管理后台配置 request/uploadFile 合法域名。

## 开发提示

- 不再使用 `cloudfunctions/`。
- 不再使用 `pages_legacy/`。
- 新增页面优先走 `apiStore`，不要在页面里直接请求后端。
- 新接口优先在 `miniprogram/services/` 增加薄封装，再由 `apiStore` 暴露给页面。
