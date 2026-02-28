const mockStore = require('./mockStore')
const authService = require('../services/auth')
const pairService = require('../services/pair')
const homeService = require('../services/home')
const menuService = require('../services/menu')
const orderService = require('../services/order')

const ENABLE_FALLBACK = true
const SILENT_REMOTE = { errorToast: false }

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

module.exports = {
  ensureMockDB() {
    return true
  },

  async bootstrapSession() {
    const token = wx.getStorageSync('authToken') || ''
    if (token) {
      try {
        const user = await authService.me(SILENT_REMOTE)
        wx.setStorageSync('authUser', user)
        return user
      } catch (err) {
        wx.removeStorageSync('authToken')
        wx.removeStorageSync('authUser')
      }
    }

    const loginRes = await authService.loginWithBootstrapAccount({ loading: false, errorToast: false })
    if (loginRes && loginRes.token) {
      wx.setStorageSync('authToken', loginRes.token)
      wx.setStorageSync('authUser', loginRes.user || null)
    }
    return loginRes ? loginRes.user : null
  },

  formatDate,

  async getHomeBanners() {
    return withFallback(() => homeService.getBanners(SILENT_REMOTE), () => mockStore.getHomeBanners())
  },

  async getPairInfo() {
    return withFallback(() => pairService.getInfo(SILENT_REMOTE), () => mockStore.getPairInfo())
  },

  async generatePairCode() {
    const data = await withFallback(
      () => pairService.generateCode(SILENT_REMOTE),
      () => ({ pairCode: mockStore.generatePairCode() })
    )
    return data.pairCode
  },

  async bindPair(inputCode) {
    return withFallback(() => pairService.bind(inputCode, SILENT_REMOTE), () => mockStore.bindPair(inputCode))
  },

  async unbindPair() {
    return withFallback(() => pairService.unbind(SILENT_REMOTE), () => mockStore.unbindPair())
  },

  async getMenuList(params) {
    return withFallback(() => menuService.list(params, SILENT_REMOTE), () => mockStore.getMenuList(params))
  },

  async getMenuById(id) {
    return withFallback(() => menuService.detail(id, SILENT_REMOTE), () => mockStore.getMenuById(id))
  },

  async addMenu(payload) {
    return withFallback(() => menuService.create(payload, SILENT_REMOTE), () => mockStore.addMenu(payload))
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
    return withFallback(() => orderService.create({ items, remark }, SILENT_REMOTE), () => mockStore.createOrder({ items, remark }))
  },

  async getOrderList(params) {
    return withFallback(() => orderService.list(params, SILENT_REMOTE), () => mockStore.getOrderList(params))
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
  }
}
