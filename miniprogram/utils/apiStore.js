const mockStore = require('./mockStore')
const authService = require('../services/auth')
const pairService = require('../services/pair')
const homeService = require('../services/home')
const menuService = require('../services/menu')
const menuCategoryService = require('../services/menuCategories')
const orderService = require('../services/order')
const notifyService = require('../services/notifications')
const candidateService = require('../services/candidates')
const preferenceService = require('../services/preferences')
const menuMarksService = require('../services/menuMarks')
const mealPlanService = require('../services/mealPlans')
const {
  ensureWxIdentity,
  ensureWxIdentityAsync,
  makePairSessionId,
  getPairContext,
  setPairContext,
  ensureDefaultPairContext,
  getActiveLinkId
} = require('./identity')

const ENABLE_FALLBACK = true
const SILENT_REMOTE = { errorToast: false }
const ENTITY_SCOPE_KEY = 'entity_scope_map_v1'
const PROFILE_READY_KEY = 'profile_ready_v1'
const DEFAULT_CATEGORY_MAP = {
  main: '主食',
  drink: '饮品',
  dessert: '甜点',
  other: '其他'
}
const DEFAULT_CAT_NAME_PREFIX = [
  '奶油', '薄荷', '糯米', '云朵', '栗子', '团团', '绒球', '布丁', '可可', '糖霜'
]
const DEFAULT_CAT_NAME_SUFFIX = [
  '喵', '团子', '小猫', '球球', '布偶', '丸子', '奶糕', '咪咪', '崽崽', '豆豆'
]
const DEFAULT_CAT_AVATARS = [
  '/images/TabBar/nainiumao.png',
  '/images/TabBar/jumao.png',
  '/images/TabBar/buoumao.png',
  '/images/TabBar/wumaomao.png',
  '/images/TabBar/sanhuamao.png',
  '/images/TabBar/baimao.png',
  '/images/TabBar/lanmao.png',
  '/images/TabBar/heimao.png',
  '/images/TabBar/xianluomao.png',
  '/images/TabBar/gengduomaochong.png'
]
let lastCategorySyncAt = 0

function getEntityScopeMap() {
  try {
    return wx.getStorageSync(ENTITY_SCOPE_KEY) || { menus: {}, orders: {} }
  } catch (err) {
    return { menus: {}, orders: {} }
  }
}

function saveEntityScopeMap(map) {
  try {
    wx.setStorageSync(ENTITY_SCOPE_KEY, map)
  } catch (err) {
    // ignore storage write errors
  }
}

function markEntityScope(type, id, linkId) {
  if (!id || !linkId) return
  const map = getEntityScopeMap()
  if (!map[type]) map[type] = {}
  map[type][id] = linkId
  saveEntityScopeMap(map)
}

function filterByScope(type, list = []) {
  const context = getPairContext() || {}
  const source = Array.isArray(list) ? list : []

  // When server already returns user-scoped data (owner=u_xxx), trust backend.
  const backendScoped = source.some((item) => {
    if (type === 'orders') return /^u_/i.test(String(item && item.creatorUserId))
    return /^u_/i.test(String(item && item.owner))
  })
  if (backendScoped) return source

  const map = getEntityScopeMap()
  const scoped = (map && map[type]) || {}
  const selfId = context.selfId || ''
  const pairSessionId = context.pairSessionId || ''

  if (context.isPaired) {
    return source.filter((item) => {
      const id = item && item._id
      if (!id) return false
      const scope = scoped[id]
      return scope === selfId || scope === pairSessionId
    })
  }

  return source.filter((item) => {
    const id = item && item._id
    if (!id) return false
    return scoped[id] === selfId
  })
}

async function withFallback(remoteCall, fallbackCall) {
  try {
    return await remoteCall()
  } catch (err) {
    const statusCode = Number(err && err.statusCode)
    const allowFallback = !statusCode || statusCode >= 500
    if (ENABLE_FALLBACK && allowFallback && typeof fallbackCall === 'function') {
      return fallbackCall(err)
    }
    throw err
  }
}

function formatDate(dateInput) {
  const d = new Date(dateInput)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

function getStoredCategoryMap() {
  const app = getApp()
  const map = app && app.globalData ? app.globalData.menuCategoryMap : null
  if (map && typeof map === 'object') return map
  return { ...DEFAULT_CATEGORY_MAP }
}

function saveCategoryMap(map = {}) {
  const app = getApp()
  const nextMap = { ...DEFAULT_CATEGORY_MAP, ...(map || {}) }
  if (app && app.globalData) app.globalData.menuCategoryMap = nextMap
  return nextMap
}

function randomPick(list = []) {
  if (!Array.isArray(list) || !list.length) return ''
  const idx = Math.floor(Math.random() * list.length)
  return list[idx]
}

function pad(num, length = 2) {
  return String(num).padStart(length, '0')
}

function buildOrderNo(identity = {}, ts = Date.now()) {
  const date = new Date(ts)
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('')
  const userId = String((identity && identity.userId) || '').trim()
  const suffix = (userId.replace(/^u_/, '').slice(-4) || '0000').toUpperCase()
  return `RC${stamp}${suffix}`
}

module.exports = {
  ensureMockDB() {
    return true
  },

  async bootstrapSession() {
    let currentUser = null
    const token = wx.getStorageSync('authToken') || ''
    if (token) {
      try {
        currentUser = await authService.me(SILENT_REMOTE)
        wx.setStorageSync('authUser', currentUser)
      } catch (err) {
        wx.removeStorageSync('authToken')
        wx.removeStorageSync('authUser')
      }
    }

    if (!currentUser) {
      const loginRes = await authService.login({ loading: false, errorToast: false })
      if (loginRes && loginRes.token) {
        wx.setStorageSync('authToken', loginRes.token)
        wx.setStorageSync('authUser', loginRes.user || null)
      }
      currentUser = loginRes ? loginRes.user : null
    }

    const identity = await ensureWxIdentityAsync(currentUser || {})
    ensureDefaultPairContext(identity.userId)

    try {
      const pair = await pairService.getInfo(SILENT_REMOTE)
      const currentCode = String((pair && pair.pairCode) || '').toUpperCase()
      if (!/^[A-Z0-9]{8}$/.test(currentCode)) {
        await pairService.generateCode(identity.wxId, SILENT_REMOTE)
      }
    } catch (err) {
      // ignore pair bootstrap failure
    }

    return currentUser
  },

  async getMyProfile() {
    return withFallback(
      () => authService.me(SILENT_REMOTE),
      () => {
        const cached = wx.getStorageSync('authUser') || {}
        return {
          ...cached,
          nickName: String(cached.nickName || ''),
          avatarUrl: String(cached.avatarUrl || '')
        }
      }
    )
  },

  isProfileReady(profile = {}) {
    const nickName = String((profile && profile.nickName) || '').trim()
    const avatarUrl = String((profile && profile.avatarUrl) || '').trim()
    if (!nickName || !avatarUrl) return false
    return !/^微信用户/i.test(nickName)
  },

  async updateMyProfile(payload = {}) {
    const next = {
      nickName: String((payload && payload.nickName) || '').trim(),
      avatarUrl: String((payload && payload.avatarUrl) || '').trim()
    }
    const res = await authService.updateProfile(next, SILENT_REMOTE)
    if (res && res.token) {
      wx.setStorageSync('authToken', res.token)
    }
    if (res && res.user) {
      wx.setStorageSync('authUser', res.user)
      ensureWxIdentity(res.user)
      wx.setStorageSync(PROFILE_READY_KEY, this.isProfileReady(res.user))
    }
    return res && res.user ? res.user : null
  },

  async ensureProfileReady() {
    const profile = await this.getMyProfile()
    const ready = this.isProfileReady(profile)
    wx.setStorageSync(PROFILE_READY_KEY, ready)
    return ready
  },

  getWxIdentity() {
    const authUser = wx.getStorageSync('authUser') || {}
    return ensureWxIdentity(authUser)
  },

  formatDate,

  buildOrderNo,

  async getHomeBanners() {
    return withFallback(() => homeService.getBanners(SILENT_REMOTE), () => mockStore.getHomeBanners())
  },

  async addHomeBanner(url) {
    return homeService.addBanner(url, SILENT_REMOTE)
  },

  async deleteHomeBanner(url) {
    return homeService.deleteBanner(url, SILENT_REMOTE)
  },

  async getPairInfo() {
    const pair = await withFallback(() => pairService.getInfo(SILENT_REMOTE), () => mockStore.getPairInfo())
    const identity = this.getWxIdentity()
    const ctx = getPairContext() || ensureDefaultPairContext(identity.userId)
    const nextCtx = {
      ...ctx,
      selfId: identity.userId,
      isPaired: !!(pair && pair.isPaired),
      skipPairing: false,
      pairSessionId: pair && pair.isPaired ? (ctx.pairSessionId || makePairSessionId(identity.userId, pair.lastBindCode || pair.pairCode)) : ''
    }
    setPairContext(nextCtx)
    try {
      await this.syncMenuCategoryMapFromMenus({ force: false, minIntervalMs: 12000 })
    } catch (err) {
      // ignore category sync errors
    }
    return pair
  },

  async generatePairCode(wxId = 'guest') {
    const data = await pairService.generateCode(wxId, SILENT_REMOTE)
    return data.pairCode
  },

  async bindPair(inputCode) {
    const identity = this.getWxIdentity()
    const result = await pairService.bind(inputCode, SILENT_REMOTE)
    setPairContext({
      selfId: identity.userId,
      isPaired: true,
      skipPairing: false,
      pairSessionId: makePairSessionId(identity.userId, inputCode)
    })
    try {
      await this.syncMenuCategoryMapFromMenus({ force: true })
    } catch (err) {
      // ignore category sync errors
    }
    return result
  },

  async unbindPair() {
    const identity = this.getWxIdentity()
    const result = await pairService.unbind(SILENT_REMOTE)
    setPairContext({
      selfId: identity.userId,
      isPaired: false,
      skipPairing: false,
      pairSessionId: ''
    })
    try {
      await this.syncMenuCategoryMapFromMenus({ force: true })
    } catch (err) {
      // ignore category sync errors
    }
    return result
  },

  skipPairing() {
    const identity = this.getWxIdentity()
    setPairContext({
      selfId: identity.userId,
      isPaired: false,
      skipPairing: true,
      pairSessionId: ''
    })
  },

  getPairContext() {
    const identity = this.getWxIdentity()
    return getPairContext() || ensureDefaultPairContext(identity.userId)
  },

  getMenuCategoryMap() {
    return { ...DEFAULT_CATEGORY_MAP, ...getStoredCategoryMap() }
  },

  setMenuCategoryMap(map = {}) {
    return saveCategoryMap(map)
  },

  async syncMenuCategoryMapFromMenus(options = {}) {
    const force = !!(options && options.force)
    const minIntervalMs = Number((options && options.minIntervalMs) || 12000)
    const now = Date.now()
    if (!force && now - lastCategorySyncAt < minIntervalMs) {
      return this.getMenuCategoryMap()
    }
    const list = await this.getMenuCategories()
    const nextMap = { ...DEFAULT_CATEGORY_MAP }
    ;(Array.isArray(list) ? list : []).forEach((item) => {
      const key = String((item && item.key) || '').trim()
      if (!key) return
      const label = String((item && item.label) || '').trim()
      nextMap[key] = label || key
    })
    lastCategorySyncAt = Date.now()
    return this.setMenuCategoryMap(nextMap)
  },

  async getMenuCategories() {
    return withFallback(
      () => menuCategoryService.list(SILENT_REMOTE),
      () => {
        const map = this.getMenuCategoryMap()
        return Object.keys(map).map((key, idx) => ({ key, label: map[key], sortOrder: idx + 1 }))
      }
    )
  },

  async upsertMenuCategory(payload = {}) {
    return menuCategoryService.upsert(payload, SILENT_REMOTE)
  },

  async reorderMenuCategories(keys = []) {
    return menuCategoryService.reorder(keys, SILENT_REMOTE)
  },

  async deleteMenuCategory(key) {
    return menuCategoryService.remove(key, SILENT_REMOTE)
  },

  async getMenuList(params) {
    const res = await withFallback(() => menuService.list(params, SILENT_REMOTE), () => mockStore.getMenuList(params))
    const rawList = Array.isArray(res.list) ? res.list : []
    const filtered = filterByScope('menus', rawList)
    const backendScoped = rawList.some((item) => /^u_/i.test(String(item && item.owner)))
    return {
      ...res,
      list: filtered,
      total: backendScoped ? Number(res.total || filtered.length) : filtered.length,
      hasMore: backendScoped ? !!res.hasMore : false
    }
  },

  async getMenuById(id) {
    return withFallback(() => menuService.detail(id, SILENT_REMOTE), () => mockStore.getMenuById(id))
  },

  async getCandidates() {
    const res = await withFallback(() => candidateService.list(SILENT_REMOTE), () => ({ list: [] }))
    return Array.isArray(res) ? res : (Array.isArray(res.list) ? res.list : [])
  },

  async addCandidate(menuId) {
    return candidateService.add(menuId, SILENT_REMOTE)
  },

  async removeCandidate(id) {
    return candidateService.remove(id, SILENT_REMOTE)
  },

  async voteCandidate(id, choice) {
    return candidateService.vote(id, choice, SILENT_REMOTE)
  },

  async getFoodPreferences() {
    return preferenceService.get(SILENT_REMOTE)
  },

  async getPartnerFoodPreferences() {
    return preferenceService.getPartner(SILENT_REMOTE)
  },

  async updateFoodPreferences(payload) {
    return preferenceService.update(payload, SILENT_REMOTE)
  },

  async getMenuMarks(kind) {
    const res = await withFallback(() => menuMarksService.list(kind, SILENT_REMOTE), () => ({ list: [] }))
    return Array.isArray(res) ? res : (Array.isArray(res.list) ? res.list : [])
  },

  async addMenuMark(kind, menuId) {
    return menuMarksService.add(kind, menuId, SILENT_REMOTE)
  },

  async removeMenuMark(kind, menuId) {
    return menuMarksService.remove(kind, menuId, SILENT_REMOTE)
  },

  async getMealPlans(options = {}) {
    const res = await withFallback(() => mealPlanService.list({ history: !!options.history, page: options.page || 1, pageSize: options.pageSize || 100 }, SILENT_REMOTE), () => ({ list: [] }))
    return Array.isArray(res) ? res : (Array.isArray(res.list) ? res.list : [])
  },
  async createMealPlan(payload) { return mealPlanService.create(payload, SILENT_REMOTE) },
  async updateMealPlan(id, payload) { return mealPlanService.update(id, payload, SILENT_REMOTE) },
  async deleteMealPlan(id) { return mealPlanService.remove(id, SILENT_REMOTE) },

  async addMenu(payload) {
    const identity = this.getWxIdentity()
    const ownedPayload = { ...payload, owner: identity.userId }
    const created = await menuService.create(ownedPayload, SILENT_REMOTE)
    if (created && created._id) {
      markEntityScope('menus', created._id, getActiveLinkId())
    }
    return created
  },

  async updateMenu(id, payload) {
    return menuService.update(id, payload, SILENT_REMOTE)
  },

  async deleteMenu(id) {
    return menuService.remove(id, SILENT_REMOTE)
  },

  async toggleMenuStatus(id, available) {
    return this.updateMenu(id, { available })
  },

  async createOrder({ items, remark, idempotencyKey }) {
    const identity = this.getWxIdentity()
    const authUser = wx.getStorageSync('authUser') || {}
    const now = Date.now()
    const payload = {
      items,
      remark,
      idempotencyKey,
      creatorUserId: String((identity && identity.userId) || '').trim(),
      creatorName: String((authUser && (authUser.nickName || authUser.username)) || (identity && identity.nickName) || '').trim(),
      creatorAvatar: String((authUser && authUser.avatarUrl) || '').trim(),
      orderNo: buildOrderNo(identity, now),
      createdAt: now
    }
    const created = await orderService.create(payload, SILENT_REMOTE)
    if (created && created._id) {
      markEntityScope('orders', created._id, getActiveLinkId())
    }
    return created
  },

  async getOrderList(params) {
    const res = await withFallback(() => orderService.list(params, SILENT_REMOTE), () => mockStore.getOrderList(params))
    const rawList = Array.isArray(res.list) ? res.list : []
    const filtered = filterByScope('orders', rawList)
    const backendScoped = rawList.some((item) => /^u_/i.test(String(item && item.creatorUserId)))
    return {
      ...res,
      list: filtered,
      total: backendScoped ? Number(res.total || filtered.length) : filtered.length,
      hasMore: backendScoped ? !!res.hasMore : false
    }
  },

  async getOrderById(id) {
    return withFallback(() => orderService.detail(id, SILENT_REMOTE), () => mockStore.getOrderById(id))
  },

  async updateOrderStatus(id, action) {
    return orderService.updateStatus(id, action, SILENT_REMOTE)
  },

  async setOrderFeedback(id, payload) {
    return orderService.feedback(id, payload, SILENT_REMOTE)
  },

  async getDishRanking(period = 'week', limit = 5) {
    return withFallback(() => homeService.getRanking(period, limit, SILENT_REMOTE), () => mockStore.getDishRanking(period, limit))
  },

  async getMostPopularDish() {
    return withFallback(() => homeService.getPopular(SILENT_REMOTE), () => mockStore.getMostPopularDish())
  },

  async getNotifySettings() {
    return withFallback(
      () => notifyService.getSettings(SILENT_REMOTE),
      () => ({ userId: '', wxOpenId: '', notifyEnabled: false, templateOrderCreated: '', wechatConfigured: false })
    )
  },

  async getNotifyTemplates() {
    return withFallback(
      () => notifyService.getTemplates(SILENT_REMOTE),
      () => ({ wechatConfigured: false, templates: [] })
    )
  },

  async updateNotifySettings(payload) {
    const nextPayload = (payload && typeof payload === 'object')
      ? payload
      : { notifyEnabled: !!payload }
    return notifyService.updateSettings(nextPayload, SILENT_REMOTE)
  },

  async bindNotifyWxSessionWithLoginCode() {
    const loginCode = await new Promise((resolve) => {
      wx.login({
        success: (res) => resolve(String((res && res.code) || '')),
        fail: () => resolve('')
      })
    })
    if (!loginCode) return null
    return notifyService.bindWxSession(loginCode, SILENT_REMOTE)
  },

  async requestOrderSubscribeAuthorization() {
    let settings
    try {
      settings = await this.getNotifySettings()
    } catch (err) {
      // Notification availability must never block order creation.
      return { requested: false, accepted: false, reason: 'SETTINGS_UNAVAILABLE' }
    }
    const templateId = String(settings.templateOrderCreated || '').trim()
    if (!templateId || typeof wx.requestSubscribeMessage !== 'function') {
      return { requested: false, accepted: false, reason: 'TEMPLATE_MISSING' }
    }

    return new Promise((resolve) => {
      wx.requestSubscribeMessage({
        tmplIds: [templateId],
        success: (res) => {
          const state = String(res[templateId] || '')
          resolve({
            requested: true,
            accepted: state === 'accept',
            state
          })
        },
        fail: () => resolve({ requested: true, accepted: false, state: 'fail' })
      })
    })
  },

  async sendNotifyTest() {
    return notifyService.sendTest(SILENT_REMOTE)
  }
}
