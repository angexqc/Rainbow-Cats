const app = getApp()
const apiStore = require('../../utils/apiStore')
const { getTopSafeHeight, computeNavbarTabPageContentHeight, getViewportMetrics } = require('../../utils/safeArea')

const ORDER_BOTTOM_BAR_HEIGHT = 72

Page({
  data: {
    topSafeHeight: 0,
    contentHeight: 0,
    bottomBarSafeHeight: 0,
    emptyStateHeight: 0,
    cart: {},
    cartItems: [],
    selectedMap: {},
    selectedCount: 0,
    totalCount: 0,
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
    this.loadCart()
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
      this.loadCart()
      this.loadWheelMenuPool()
    })
  },

  updateViewportMetrics() {
    const topSafeHeight = getTopSafeHeight()
    const metrics = computeNavbarTabPageContentHeight(topSafeHeight)
    const safeBottomInset = Number((getViewportMetrics() || {}).safeBottomInset || 0)
    const contentHeight = Number(metrics.contentHeight || 0) - ORDER_BOTTOM_BAR_HEIGHT - safeBottomInset
    const safeContentHeight = contentHeight > 0 ? contentHeight : 0
    this.setData({
      topSafeHeight,
      bottomBarSafeHeight: safeBottomInset,
      contentHeight: safeContentHeight,
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
    const cart = wx.getStorageSync('cart') || {}
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

  async loadWheelMenuPool() {
    if (this.data.wheelLoading) return
    this.setData({ wheelLoading: true })
    try {
      const res = await apiStore.getMenuList({
        available: true,
        page: 1,
        pageSize: 80
      })
      const source = Array.isArray(res.list) ? res.list : []
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
        style: `transform: rotate(${angle}deg) translateY(-92rpx) rotate(-${angle}deg);`
      }
    })
  },

  truncateWheelTitle(title) {
    const text = String(title || '').trim()
    return text.length > 5 ? `${text.slice(0, 5)}…` : text
  },

  spinWheel() {
    if (this.data.wheelSpinning) return
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
    const cart = wx.getStorageSync('cart') || {}
    const id = menu._id
    if (cart[id]) {
      cart[id].count = Number(cart[id].count || 0) + 1
    } else {
      cart[id] = { menu, count: 1 }
    }
    wx.setStorageSync('cart', cart)
    this.loadCart()
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  saveCart() {
    wx.setStorageSync('cart', this.data.cart)
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

    const lines = items.map((it) => `${it.title} x${it.count}`)
    const content = `确认下单以下菜品？\n${lines.join('\n')}`

    wx.showModal({
      title: '确认下单',
      content,
      success: async (res) => {
        if (!res.confirm) return

        try {
          await apiStore.requestOrderSubscribeAuthorization()
          await apiStore.createOrder({
            items: items.map((it) => ({
              menuId: it.menuId,
              title: it.title,
              image: it.image,
              desc: '',
              count: it.count
            })),
            remark: ''
          })

          const cart = { ...this.data.cart }
          items.forEach((it) => { delete cart[it.menuId] })
          this.setData({ cart })
          this.saveCart()
          this.loadCart()

          wx.showToast({ title: '下单成功', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: '下单失败', icon: 'none' })
        }
      }
    })
  },

  onUnload() {
    clearTimeout(this.wheelTimer)
  }
})
