const mockStore = require('./mockStore')
const authService = require('../services/auth')
const pairService = require('../services/pair')
const homeService = require('../services/home')
const menuService = require('../services/menu')
const menuCategoryService = require('../services/menuCategories')
const orderService = require('../services/order')
const notifyService = require('../services/notifications')
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
const PAIR_CODE_SYNC_KEY = 'pair_code_synced_v1'
const PROFILE_READY_KEY = 'profile_ready_v1'
const DEFAULT_CATEGORY_MAP = {
  main: '主食',
  drink: '饮品',
  dessert: '甜点',
  other: '其他'
}
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
      const codeSynced = !!wx.getStorageSync(PAIR_CODE_SYNC_KEY)
      if (!/^[A-Z0-9]{8}$/.test(currentCode) && !codeSynced) {
        await pairService.generateCode(identity.wxId, SILENT_REMOTE)
        wx.setStorageSync(PAIR_CODE_SYNC_KEY, true)
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
    const res = await withFallback(
      () => authService.updateProfile(next, SILENT_REMOTE),
      () => ({ token: wx.getStorageSync('authToken') || '', user: { ...(wx.getStorageSync('authUser') || {}), ...next } })
    )
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

  async getHomeBanners() {
    return withFallback(() => homeService.getBanners(SILENT_REMOTE), () => mockStore.getHomeBanners())
  },

  async addHomeBanner(url) {
    return withFallback(() => homeService.addBanner(url, SILENT_REMOTE), () => ({ id: Date.now(), url, sortOrder: 0 }))
  },

  async deleteHomeBanner(url) {
    return withFallback(
      () => homeService.deleteBanner(url, SILENT_REMOTE),
      () => mockStore.deleteHomeBanner(url)
    )
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
    const data = await withFallback(
      () => pairService.generateCode(wxId, SILENT_REMOTE),
      () => ({ pairCode: mockStore.generatePairCode() })
    )
    return data.pairCode
  },

  async bindPair(inputCode) {
    const identity = this.getWxIdentity()
    const result = await withFallback(() => pairService.bind(inputCode, SILENT_REMOTE), () => mockStore.bindPair(inputCode))
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
    const result = await withFallback(() => pairService.unbind(SILENT_REMOTE), () => mockStore.unbindPair())
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
    return withFallback(
      () => menuCategoryService.upsert(payload, SILENT_REMOTE),
      () => {
        const key = String((payload && payload.key) || '').trim()
        const label = String((payload && payload.label) || '').trim()
        if (!key || !label) return null
        const map = this.getMenuCategoryMap()
        map[key] = label
        this.setMenuCategoryMap(map)
        return { key, label }
      }
    )
  },

  async reorderMenuCategories(keys = []) {
    return withFallback(
      () => menuCategoryService.reorder(keys, SILENT_REMOTE),
      () => this.getMenuCategories()
    )
  },

  async deleteMenuCategory(key) {
    return withFallback(
      () => menuCategoryService.remove(key, SILENT_REMOTE),
      () => true
    )
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

  async addMenu(payload) {
    const identity = this.getWxIdentity()
    const ownedPayload = { ...payload, owner: identity.userId }
    const created = await withFallback(() => menuService.create(ownedPayload, SILENT_REMOTE), () => mockStore.addMenu(ownedPayload))
    if (created && created._id) {
      markEntityScope('menus', created._id, getActiveLinkId())
    }
    return created
  },

  async updateMenu(id, payload) {
    return withFallback(() => menuService.update(id, payload, SILENT_REMOTE), () => mockStore.updateMenu(id, payload))
  },

  async deleteMenu(id) {
    return withFallback(() => menuService.remove(id, SILENT_REMOTE), () => mockStore.deleteMenu(id))
  },

  async toggleMenuStatus(id, available) {
    return this.updateMenu(id, { available })
  },

  async createOrder({ items, remark }) {
    const created = await withFallback(() => orderService.create({ items, remark }, SILENT_REMOTE), () => mockStore.createOrder({ items, remark }))
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
    return withFallback(() => orderService.updateStatus(id, action, SILENT_REMOTE), () => mockStore.updateOrderStatus(id, action))
  },

  async setOrderFeedback(id, payload) {
    return withFallback(() => orderService.feedback(id, payload, SILENT_REMOTE), () => mockStore.setOrderFeedback(id, payload))
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
    return withFallback(
      () => notifyService.updateSettings(nextPayload, SILENT_REMOTE),
      () => ({
        userId: '',
        wxOpenId: '',
        notifyEnabled: !!nextPayload.notifyEnabled,
        templateOrderCreated: String(nextPayload.templateOrderCreated || ''),
        wechatConfigured: false
      })
    )
  },

  async bindNotifyWxSessionWithLoginCode() {
    const loginCode = await new Promise((resolve) => {
      wx.login({
        success: (res) => resolve(String((res && res.code) || '')),
        fail: () => resolve('')
      })
    })
    if (!loginCode) return null
    return withFallback(
      () => notifyService.bindWxSession(loginCode, SILENT_REMOTE),
      () => null
    )
  },

  async requestOrderSubscribeAuthorization() {
    const settings = await this.getNotifySettings()
    const templateId = String(settings.templateOrderCreated || '').trim()
    if (!templateId) {
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
    return withFallback(() => notifyService.sendTest(SILENT_REMOTE), () => ({ sent: false, reason: 'MOCK' }))
  }
}
