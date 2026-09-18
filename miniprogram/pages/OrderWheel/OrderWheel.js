const app = getApp()
const apiStore = require('../../utils/apiStore')
const cartStore = require('../../utils/cartStore')
const { getTopSafeHeight, computeContentHeight } = require('../../utils/safeArea')
const { filterMenusByPreferences } = require('../../utils/foodPreferenceRules')

Page({
  data: {
    topSafeHeight: 0,
    contentHeight: 0,
    menuPool: [],
    wheelSlots: [],
    wheelSpinning: false,
    wheelRotate: 0,
    wheelPicked: null,
    wheelLoading: false,
    categoryMap: app.globalData ? app.globalData.menuCategoryMap : {
      main: '主食',
      drink: '饮品',
      dessert: '甜点',
      other: '其他'
    }
  },

  onLoad() {
    this.lastCategorySyncAt = 0
    this.updateViewportMetrics()
    this.loadWheelMenuPool()
  },

  onShow() {
    this.updateViewportMetrics()
    const now = Date.now()
    const needSync = !this.lastCategorySyncAt || (now - this.lastCategorySyncAt > 15000)
    const syncTask = needSync
      ? Promise.resolve()
        .then(() => apiStore.syncMenuCategoryMapFromMenus({ force: false }))
        .then(() => { this.lastCategorySyncAt = Date.now() })
        .catch(() => null)
      : Promise.resolve()

    syncTask.finally(() => {
      this.setData({
        categoryMap: app.globalData ? app.globalData.menuCategoryMap : this.data.categoryMap
      })
      this.loadWheelMenuPool()
    })
  },

  updateViewportMetrics() {
    const topSafeHeight = getTopSafeHeight()
    const metrics = computeContentHeight({ topSafeHeight })
    this.setData({
      topSafeHeight,
      contentHeight: Number(metrics.contentHeight || 0)
    })
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/Order/Order' })
  },

  resolveCategoryLabel(itemOrKey) {
    if (itemOrKey && typeof itemOrKey === 'object') {
      const directLabel = String(itemOrKey.categoryLabel || '').trim()
      if (directLabel) return directLabel
    }
    const rawKey = String((itemOrKey && itemOrKey.category) || itemOrKey || '').trim()
    const map = this.data.categoryMap || {}
    const fromMap = String(map[rawKey] || '').trim()
    if (fromMap) return fromMap
    if (rawKey.startsWith('custom_')) return '自定义分类'
    return rawKey || '未分类'
  },

  async loadWheelMenuPool() {
    if (this.data.wheelLoading || this.data.wheelSpinning) return
    this.setData({ wheelLoading: true })
    try {
      const res = await apiStore.getMenuList({
        available: true,
        page: 1,
        pageSize: 80
      })
      const [mine, partner] = await Promise.all([
        apiStore.getFoodPreferences().catch(() => null),
        apiStore.getPartnerFoodPreferences().catch(() => null)
      ])
      const sharedPartner = partner && partner.shared !== false ? partner : null
      const source = filterMenusByPreferences(Array.isArray(res.list) ? res.list : [], [mine, sharedPartner])
      const menuPool = source
        .filter((item) => item && item._id && item.title)
        .map((item) => ({
          _id: item._id,
          title: item.title,
          image: item.image || '',
          desc: item.desc || '',
          category: item.category || '',
          categoryLabel: item.categoryLabel || '',
          categoryDisplay: this.resolveCategoryLabel(item)
        }))
      this.setData({
        menuPool,
        wheelSlots: this.buildWheelSlots(menuPool),
        wheelLoading: false
      })
      if (!menuPool.length && Array.isArray(res.list) && res.list.length) {
        wx.showToast({ title: '菜品都与当前忌口冲突', icon: 'none' })
      }
    } catch (err) {
      this.setData({ wheelLoading: false })
    }
  },

  buildWheelSlots(menuPool = []) {
    const source = Array.isArray(menuPool) ? menuPool.slice(0, 8) : []
    const fallback = source.length ? source : [{ title: '等菜单' }]
    const step = 360 / fallback.length
    return fallback.map((item, index) => {
      const angle = Math.round(index * step)
      return {
        key: item._id || `slot_${index}`,
        title: item.title,
        shortTitle: this.truncateWheelTitle(item.title),
        style: `transform: rotate(${angle}deg) translateY(-192rpx) rotate(-${angle}deg);`
      }
    })
  },

  truncateWheelTitle(title) {
    return String(title || '').trim()
  },

  spinWheel() {
    if (this.data.wheelSpinning || this.data.wheelLoading) return
    const menuPool = this.data.menuPool || []
    if (!menuPool.length) {
      wx.showToast({ title: '暂无可选菜品', icon: 'none' })
      this.loadWheelMenuPool()
      return
    }

    const pickIndex = Math.floor(Math.random() * menuPool.length)
    const picked = menuPool[pickIndex]
    const slotCount = Math.max(1, Math.min(menuPool.length, 8))
    const slotIndex = pickIndex % slotCount
    const segment = 360 / slotCount
    const targetAngle = 360 - (slotIndex * segment) - (segment / 2)
    const rounds = 4 + Math.floor(Math.random() * 2)
    const nextRotate = Number(this.data.wheelRotate || 0) + (rounds * 360) + targetAngle

    this.setData({
      wheelSpinning: true,
      wheelPicked: null,
      wheelRotate: nextRotate
    })

    clearTimeout(this.wheelTimer)
    this.wheelTimer = setTimeout(() => {
      this.setData({
        wheelSpinning: false,
        wheelPicked: picked
      })
    }, 1900)
  },

  addWheelPickedToCart() {
    const picked = this.data.wheelPicked
    if (!picked || !picked._id) {
      this.spinWheel()
      return
    }
    this.addMenuToCart(picked)
  },

  addMenuToCart(menu) {
    if (!menu || !menu._id) return
    const cart = cartStore.getCart()
    const id = menu._id
    if (cart[id]) {
      cart[id].count = Number(cart[id].count || 0) + 1
    } else {
      cart[id] = { menu, count: 1 }
    }
    cartStore.setCart(cart)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  onUnload() {
    clearTimeout(this.wheelTimer)
  }
})
