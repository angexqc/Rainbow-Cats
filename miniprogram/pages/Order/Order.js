const app = getApp()
const apiStore = require('../../utils/apiStore')
const cartStore = require('../../utils/cartStore')
const { getTopSafeHeight, getCapsuleMetrics, computeContentHeight, getViewportMetrics } = require('../../utils/safeArea')

const ORDER_BOTTOM_BAR_HEIGHT = 72

Page({
  data: {
    topSafeHeight: 0,
    contentHeight: 0,
    capsuleSafeRight: 104,
    bottomBarSafeHeight: 0,
    emptyStateHeight: 0,
    cart: {},
    cartItems: [],
    selectedMap: {},
    selectedCount: 0,
    totalCount: 0,
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
    this.loadCart()
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
      this.loadCart()
    })
  },

  updateViewportMetrics() {
    const topSafeHeight = getTopSafeHeight()
    const metrics = computeContentHeight({ topSafeHeight, bottomBarHeight: ORDER_BOTTOM_BAR_HEIGHT })
    const safeBottomInset = Number((getViewportMetrics() || {}).safeBottomInset || 0)
    this.setData({
      topSafeHeight,
      capsuleSafeRight: getCapsuleMetrics().safeRight,
      bottomBarSafeHeight: safeBottomInset,
      contentHeight: Number(metrics.contentHeight || 0),
      emptyStateHeight: Number(metrics.contentHeight || 0)
    })
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

  loadCart() {
    const cart = cartStore.getCart()
    const cartItems = Object.values(cart)
      .filter((item) => item.menu)
      .map((item) => ({
        menuId: item.menu._id,
        title: item.menu.title,
        image: item.menu.image,
        count: Number(item.count || 0),
        category: item.menu.category,
        categoryLabel: item.menu.categoryLabel || '',
        categoryDisplay: this.resolveCategoryLabel(item.menu)
      }))

    const selectedMap = {}
    cartItems.forEach((it) => { selectedMap[it.menuId] = true })

    this.setData({ cart, cartItems, selectedMap })
    this.recalculateStats()
  },

  goOrderWheel() {
    wx.navigateTo({ url: '/pages/OrderWheel/OrderWheel' })
  },

  saveCart() {
    cartStore.setCart(this.data.cart)
  },

  recalculateStats() {
    const selectedIds = Object.keys(this.data.selectedMap).filter((id) => this.data.selectedMap[id])
    const selectedCount = selectedIds.length
    const totalCount = this.data.cartItems
      .filter((it) => this.data.selectedMap[it.menuId])
      .reduce((sum, it) => sum + it.count, 0)

    this.setData({ selectedCount, totalCount })
  },

  toggleSelectAll() {
    const allSelected = this.data.cartItems.length > 0 && this.data.selectedCount === this.data.cartItems.length
    const selectedMap = {}
    this.data.cartItems.forEach((item) => {
      selectedMap[item.menuId] = !allSelected
    })
    this.setData({ selectedMap })
    this.recalculateStats()
  },

  toggleSelect(e) {
    const { id } = e.currentTarget.dataset
    const selectedMap = { ...this.data.selectedMap }
    selectedMap[id] = !selectedMap[id]
    this.setData({ selectedMap })
    this.recalculateStats()
  },

  increaseCount(e) {
    const { id } = e.currentTarget.dataset
    const cart = { ...this.data.cart }
    if (!cart[id]) return
    cart[id].count += 1
    this.setData({ cart })
    this.saveCart()
    this.loadCart()
  },

  decreaseCount(e) {
    const { id } = e.currentTarget.dataset
    const cart = { ...this.data.cart }
    if (!cart[id]) return
    if (cart[id].count > 1) {
      cart[id].count -= 1
    } else {
      delete cart[id]
    }
    this.setData({ cart })
    this.saveCart()
    this.loadCart()
  },

  deleteOne(e) {
    const { id } = e.currentTarget.dataset
    const cart = { ...this.data.cart }
    if (!cart[id]) return

    wx.showModal({
      title: '删除菜品',
      content: '确认从购物车删除该菜品？',
      success: (res) => {
        if (!res.confirm) return
        delete cart[id]
        this.setData({ cart })
        this.saveCart()
        this.loadCart()
      }
    })
  },

  deleteBatch() {
    const ids = Object.keys(this.data.selectedMap).filter((id) => this.data.selectedMap[id])
    if (!ids.length) {
      wx.showToast({ title: '请先勾选菜品', icon: 'none' })
      return
    }

    wx.showModal({
      title: '批量删除',
      content: `确认删除已勾选的 ${ids.length} 个菜品？`,
      success: (res) => {
        if (!res.confirm) return
        const cart = { ...this.data.cart }
        ids.forEach((id) => { delete cart[id] })
        this.setData({ cart })
        this.saveCart()
        this.loadCart()
      }
    })
  },

  clearAll() {
    if (!this.data.cartItems.length) return
    wx.showModal({
      title: '清空购物车',
      content: '确认删除购物车全部菜品？',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ cart: {} })
        this.saveCart()
        this.loadCart()
      }
    })
  },

  submitOrder() {
    const items = this.data.cartItems.filter((it) => this.data.selectedMap[it.menuId])
    if (!items.length) {
      wx.showToast({ title: '请先勾选菜品', icon: 'none' })
      return
    }

    cartStore.setCheckout({
      items: items.map((it) => ({ ...it, desc: it.desc || '' })),
      idempotencyKey: `wx-${Date.now()}-${Math.random().toString(16).slice(2)}`
    })
    wx.navigateTo({ url: '/pages/OrderConfirm/OrderConfirm' })
  }
})
