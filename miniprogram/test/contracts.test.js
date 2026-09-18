const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

test('全局主题使用清新绿，主色和 tabBar 不回退为粉色', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
  const style = fs.readFileSync(path.join(root, 'app.wxss'), 'utf8')
  assert.equal(app.tabBar.selectedColor, '#2F9B66')
  assert.equal(app.tabBar.backgroundColor, '#F4FBF7')
  assert.match(style, /--rc-primary:\s*#43ad78/)
  assert.match(style, /--rc-primary-strong:\s*#257a50/)
  assert.match(style, /--rc-bg:\s*#f3fbf6/)
  assert.doesNotMatch(style, /--rc-primary:\s*#ff6f98/i)
})

test('通知设置和订单确认页已注册且存在入口', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
  assert.ok(app.pages.includes('pages/NotifySettings/index'))
  assert.ok(app.pages.includes('pages/OrderConfirm/OrderConfirm'))
  const myPage = fs.readFileSync(path.join(root, 'pages/My/My.js'), 'utf8')
  const orderPage = fs.readFileSync(path.join(root, 'pages/Order/Order.js'), 'utf8')
  assert.match(myPage, /pages\/NotifySettings\/index/)
  assert.match(orderPage, /pages\/OrderConfirm\/OrderConfirm/)
})

test('我的页面首行展示双方资料，其他入口采用两列布局并避开微信胶囊', () => {
  const page = fs.readFileSync(path.join(root, 'pages/My/My.wxml'), 'utf8')
  const style = fs.readFileSync(path.join(root, 'pages/My/My.wxss'), 'utf8')
  const logic = fs.readFileSync(path.join(root, 'pages/My/My.js'), 'utf8')
  assert.match(page, /class="[^"]*profile-hero[^"]*"/)
  const fixedAt = page.indexOf('class="profile-fixed"')
  const scrollAt = page.indexOf('<scroll-view')
  assert.ok(fixedAt >= 0 && scrollAt > fixedAt, '双方资料应固定在滚动内容之外')
  assert.doesNotMatch(page, /myContentHeight/)
  assert.match(style, /\.page > \.content[\s\S]*flex:\s*1 1 auto/)
  assert.match(page, /class="profile-avatar"/)
  assert.match(page, /profile\.nickName/)
  assert.match(page, /partnerInfo\.nickName/)
  assert.doesNotMatch(page, /\.slice\(/)
  assert.match(page, /class="action-grid"/)
  const actionGrid = page.match(/<view class="action-grid">([\s\S]*?)<\/view>/)
  assert.equal((actionGrid && actionGrid[1].match(/<button/g) || []).length, 4)
  assert.match(style, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(style, /\.content > \.section\.block[\s\S]*min-height:/)
  assert.match(page, /padding-right:\s*\{\{capsuleSafeRight\}\}px/)
  assert.match(logic, /getCapsuleMetrics\(\)\.safeRight/)
  assert.match(logic, /apiStore\.getMyProfile\(\)/)
})

test('首页轮播只保留图片，不渲染遮罩和压盖文字', () => {
  const home = fs.readFileSync(path.join(root, 'pages/Home/index.wxml'), 'utf8')
  assert.match(home, /class="magazine-image"/)
  assert.doesNotMatch(home, /magazine-mask|magazine-frame|magazine-copy|magazine-issue/)
})

test('所有带右侧操作的自定义导航都使用运行时胶囊安全边界', () => {
  const targets = [
    ['pages/Menu/Menu.js', 'pages/Menu/Menu.wxml'],
    ['pages/Order/Order.js', 'pages/Order/Order.wxml'],
    ['pages/My/My.js', 'pages/My/My.wxml'],
    ['pages/MenuAdd/MenuAdd.js', 'pages/MenuAdd/MenuAdd.wxml'],
    ['pages/MenuEdit/MenuEdit.js', 'pages/MenuEdit/MenuEdit.wxml']
  ]
  for (const [logicPath, viewPath] of targets) {
    const logic = fs.readFileSync(path.join(root, logicPath), 'utf8')
    const view = fs.readFileSync(path.join(root, viewPath), 'utf8')
    assert.match(logic, /getCapsuleMetrics\(\)\.safeRight/, logicPath)
    assert.match(view, /padding-right:\s*\{\{capsuleSafeRight\}\}px/, viewPath)
  }
})

test('共同选菜页面和接口入口已注册', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
  assert.ok(app.pages.includes('pages/Candidates/Candidates'))
  assert.ok(fs.existsSync(path.join(root, 'pages/Candidates/Candidates.js')))
  const service = fs.readFileSync(path.join(root, 'services/candidates.js'), 'utf8')
  assert.match(service, /\/candidates/)
})

test('口味偏好页面、接口和隐私默认值符合契约', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
  assert.ok(app.pages.includes('pages/FoodPreferences/FoodPreferences'))
  const page = fs.readFileSync(path.join(root, 'pages/FoodPreferences/FoodPreferences.js'), 'utf8')
  const view = fs.readFileSync(path.join(root, 'pages/FoodPreferences/FoodPreferences.wxml'), 'utf8')
  const service = fs.readFileSync(path.join(root, 'services/preferences.js'), 'utf8')
  const apiStore = fs.readFileSync(path.join(root, 'utils/apiStore.js'), 'utf8')
  assert.match(page, /shareWithPartner: false/)
  assert.match(page, /updateFoodPreferences\(/)
  assert.match(view, /不提供医疗建议/)
  assert.match(service, /method: 'PATCH', path: '\/preferences'/)
  const start = apiStore.indexOf('async updateFoodPreferences')
  const end = apiStore.indexOf('\n  },', start)
  assert.doesNotMatch(apiStore.slice(start, end), /withFallback\(/)
})

test('收藏和想吃清单保持独立资源且写操作不降级', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
  assert.ok(app.pages.includes('pages/SavedMenus/SavedMenus'))
  const service = fs.readFileSync(path.join(root, 'services/menuMarks.js'), 'utf8')
  const store = fs.readFileSync(path.join(root, 'utils/apiStore.js'), 'utf8')
  const page = fs.readFileSync(path.join(root, 'pages/SavedMenus/SavedMenus.js'), 'utf8')
  const view = fs.readFileSync(path.join(root, 'pages/SavedMenus/SavedMenus.wxml'), 'utf8')
  assert.match(service, /'\/favorites'/)
  assert.match(service, /'\/wish-list'/)
  assert.match(view, /item\.shared/)
  assert.match(page, /mark\.menu\.available/)
  for (const method of ['addMenuMark', 'removeMenuMark']) {
    const start = store.indexOf(`async ${method}`)
    const end = store.indexOf('\n  },', start)
    assert.ok(start >= 0)
    assert.doesNotMatch(store.slice(start, end), /withFallback\(/)
  }
})

test('随机点餐过滤已共享偏好且订单确认显示风险提醒', () => {
  const wheel = fs.readFileSync(path.join(root, 'pages/OrderWheel/OrderWheel.js'), 'utf8')
  const confirm = fs.readFileSync(path.join(root, 'pages/OrderConfirm/OrderConfirm.js'), 'utf8')
  const preferenceView = fs.readFileSync(path.join(root, 'pages/FoodPreferences/FoodPreferences.wxml'), 'utf8')
  assert.match(wheel, /filterMenusByPreferences/)
  assert.match(wheel, /partner && partner\.shared !== false/)
  assert.match(confirm, /getMenuConflicts/)
  assert.match(confirm, /这只是偏好提醒，请自行确认/)
  assert.doesNotMatch(preferenceView, /\.includes\(/, 'WXML 不应调用 Array.prototype 方法')
})

test('用餐计划页面和接口保持独立，不自动创建订单', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
  assert.ok(app.pages.includes('pages/MealPlans/MealPlans'))
  const service = fs.readFileSync(path.join(root, 'services/mealPlans.js'), 'utf8')
  const page = fs.readFileSync(path.join(root, 'pages/MealPlans/MealPlans.js'), 'utf8')
  const view = fs.readFileSync(path.join(root, 'pages/MealPlans/MealPlans.wxml'), 'utf8')
  assert.match(service, /\/meal-plans/)
  assert.match(page, /planDate/)
  assert.match(page, /mealType/)
  assert.match(page, /addCart/)
  assert.doesNotMatch(page, /createOrder\(/)
  assert.match(view, /创建计划/)
})

test('业务写路径不使用 withFallback 或固定 cart 键', () => {
  const apiStore = fs.readFileSync(path.join(root, 'utils/apiStore.js'), 'utf8')
  const writeMethods = [
    'updateMyProfile', 'addHomeBanner', 'deleteHomeBanner', 'generatePairCode', 'bindPair', 'unbindPair',
    'upsertMenuCategory', 'reorderMenuCategories', 'deleteMenuCategory',
    'addCandidate', 'removeCandidate', 'voteCandidate', 'updateFoodPreferences',
    'addMenuMark', 'removeMenuMark', 'createMealPlan', 'updateMealPlan', 'deleteMealPlan',
    'addMenu', 'updateMenu', 'deleteMenu', 'toggleMenuStatus', 'createOrder',
    'updateOrderStatus', 'setOrderFeedback', 'updateNotifySettings',
    'bindNotifyWxSessionWithLoginCode', 'sendNotifyTest'
  ]
  for (const method of writeMethods) {
    const start = apiStore.indexOf(`async ${method}`)
    assert.ok(start >= 0, `${method} 必须存在`)
    const nextMethod = apiStore.indexOf('\n  async ', start + 1)
    const end = nextMethod >= 0 ? nextMethod : apiStore.length
    assert.doesNotMatch(apiStore.slice(start, end), /withFallback\(/, `${method} 不得静默 fallback`)
  }
  const pageFiles = [
    'pages/Home/index.js', 'pages/Menu/Menu.js', 'pages/Order/Order.js',
    'pages/OrderConfirm/OrderConfirm.js', 'pages/OrderWheel/OrderWheel.js',
    'pages/OrderDetail/OrderDetail.js', 'pages/MenuHistory/MenuHistory.js'
  ]
  for (const file of pageFiles) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.doesNotMatch(source, /(?:get|set)StorageSync\(['"]cart['"]/, `${file} 不得使用固定 cart 键`)
  }
})

test('订单确认链路传递备注和幂等键，成功后才清理购物车', () => {
  const order = fs.readFileSync(path.join(root, 'pages/Order/Order.js'), 'utf8')
  const confirm = fs.readFileSync(path.join(root, 'pages/OrderConfirm/OrderConfirm.js'), 'utf8')
  const apiStore = fs.readFileSync(path.join(root, 'utils/apiStore.js'), 'utf8')

  assert.match(order, /cartStore\.setCheckout\([\s\S]*idempotencyKey:/)
  assert.match(order, /navigateTo\(\{ url: '\/pages\/OrderConfirm\/OrderConfirm' \}\)/)
  assert.match(confirm, /apiStore\.createOrder\(\{[\s\S]*items: cartItems,[\s\S]*remark,[\s\S]*idempotencyKey:/)
  const createAt = confirm.indexOf('await apiStore.createOrder')
  const removeAt = confirm.indexOf('cartStore.removeItems')
  const clearAt = confirm.indexOf('cartStore.clearCheckout')
  assert.ok(createAt >= 0 && removeAt > createAt && clearAt > removeAt, '下单成功后才能清理已提交购物车')
  assert.match(apiStore, /async createOrder\(\{ items, remark, idempotencyKey \}\)[\s\S]*remark,[\s\S]*idempotencyKey,/)
})

test('通知授权不阻断下单，通知开关和模板权限分别处理', () => {
  const confirm = fs.readFileSync(path.join(root, 'pages/OrderConfirm/OrderConfirm.js'), 'utf8')
  const settings = fs.readFileSync(path.join(root, 'pages/NotifySettings/index.js'), 'utf8')
  const settingsView = fs.readFileSync(path.join(root, 'pages/NotifySettings/index.wxml'), 'utf8')

  const subscribeAt = confirm.indexOf('requestOrderSubscribeAuthorization')
  const createAt = confirm.indexOf('await apiStore.createOrder')
  assert.ok(subscribeAt >= 0 && createAt > subscribeAt, '下单前请求订阅授权')
  assert.match(confirm, /!subscribeResult\.accepted[\s\S]*订单仍会正常创建/)
  assert.match(settings, /updateNotifySettings\(\{ notifyEnabled: true \}\)/)
  assert.match(settings, /if \(!this\.data\.isAdmin\)/)
  assert.match(settingsView, /wx:if="\{\{isAdmin\}\}"/)
})

test('菜单 owner 筛选在请求参数中传给服务端', () => {
  const menuPage = fs.readFileSync(path.join(root, 'pages/Menu/Menu.js'), 'utf8')
  assert.match(menuPage, /owner: this\.data\.ownerFilter === 'me' \? 'self' : this\.data\.ownerFilter === 'ta' \? 'partner' : ''/)
  assert.match(menuPage, /\.\.\.\(item \|\| \{\}\)/, '菜单映射必须保留 available、desc 和服务端扩展字段')
  assert.match(menuPage, /String\(\(item && item\.ownerName\) \|\| ''\)\.trim\(\)/, '缺失创建者昵称时不能渲染 undefined')
})

test('确认页由服务端校验菜品状态并展示领域错误', () => {
  const confirm = fs.readFileSync(path.join(root, 'pages/OrderConfirm/OrderConfirm.js'), 'utf8')
  assert.doesNotMatch(confirm, /item\.menu\.available/, '不能用可能过期或缺失的前端 available 缓存拦截下单')
  assert.match(confirm, /bizCode === 12002/)
  assert.match(confirm, /bizCode === 12001/)
  assert.match(confirm, /bizCode === 13004/)
})

test('通知设置读取失败不会阻断创建订单', () => {
  const apiStore = fs.readFileSync(path.join(root, 'utils/apiStore.js'), 'utf8')
  const start = apiStore.indexOf('async requestOrderSubscribeAuthorization')
  const end = apiStore.indexOf('\n  },', start)
  const method = apiStore.slice(start, end)
  assert.match(method, /SETTINGS_UNAVAILABLE/)
  assert.match(method, /try[\s\S]*getNotifySettings\(\)[\s\S]*catch/)
})

test('配对页匹配配对码生命周期错误', () => {
  const pairPage = fs.readFileSync(path.join(root, 'pages/Pair/Pair.js'), 'utf8')
  const pairView = fs.readFileSync(path.join(root, 'pages/Pair/Pair.wxml'), 'utf8')
  assert.match(pairPage, /bizCode === 14005/)
  assert.match(pairPage, /bizCode === 14006/)
  assert.doesNotMatch(pairView, /可长期使用/)
})

test('开发版使用本机 API，发布版保持 HTTPS，远程 HTTP 上传被拒绝', () => {
  const {
    PROD_API_BASE_URL,
    LOCAL_API_BASE_URL,
    normalizeApiBase,
    selectApiBase,
    isAllowedUploadApiBase
  } = require('../services/apiBase')
  const developWx = { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }) }
  const releaseWx = { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }) }

  assert.equal(selectApiBase('', developWx), LOCAL_API_BASE_URL)
  assert.equal(selectApiBase(PROD_API_BASE_URL, developWx), LOCAL_API_BASE_URL)
  assert.equal(selectApiBase('', releaseWx), PROD_API_BASE_URL)
  assert.equal(normalizeApiBase('http://127.0.0.1:3100/api/'), LOCAL_API_BASE_URL)
  assert.equal(normalizeApiBase('http://api.example.com/api'), 'https://api.example.com/api')
  assert.equal(isAllowedUploadApiBase(LOCAL_API_BASE_URL), true)
  assert.equal(isAllowedUploadApiBase(PROD_API_BASE_URL), true)
  assert.equal(isAllowedUploadApiBase('http://api.example.com/api'), false)

  const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
  const onLaunchAt = appSource.indexOf('onLaunch()')
  const selectAt = appSource.indexOf('selectApiBase(', onLaunchAt)
  const prepareAt = appSource.indexOf('this.prepareLaunchState()', onLaunchAt)
  assert.ok(selectAt > onLaunchAt && prepareAt > selectAt, '必须先确定 API 地址，再启动网络初始化')
})
