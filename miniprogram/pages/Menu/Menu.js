const app = getApp()
const apiStore = require('../../utils/apiStore')
const cartStore = require('../../utils/cartStore')
const { getTopSafeHeight, getCapsuleMetrics, computeNavbarTabPageContentHeight } = require('../../utils/safeArea')
const { buildSharePayload, buildTimelinePayload } = require('../../utils/share')

Page({
  data: {
    topSafeHeight: 0,
    contentHeight: 0,
    capsuleSafeRight: 104,
    pageLoading: true,
    menuList: [],
    keyword: '',
    currentCategory: '',
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 12,
    refresherTriggered: false,
    cartCount: 0,
    unconfirmedCount: 0,
    cartMap: {},
    favoriteMap: {},
    wishMap: {},
    isPaired: false,
    ownerFilter: '',
    ownerFilters: [
      { key: '', label: '全部' },
      { key: 'me', label: '我' },
      { key: 'ta', label: '对方' }
    ],
    selfUserId: '',
    categoryMap: app.globalData ? app.globalData.menuCategoryMap : {
      main: '主食',
      drink: '饮品',
      dessert: '甜点',
      other: '其他'
    },
    categoryList: []
  },

  onLoad() {
    this.skipNextShow = true
    this.lastEntryLoadedAt = 0
    const topSafeHeight = getTopSafeHeight()
    this.setData({
      topSafeHeight,
      capsuleSafeRight: getCapsuleMetrics().safeRight,
      contentHeight: computeNavbarTabPageContentHeight(topSafeHeight).contentHeight
    })
    this.runEntryLoad({ force: true, withOverlay: true })
  },

  onShow() {
    const topSafeHeight = Number(this.data.topSafeHeight || getTopSafeHeight())
    this.setData({
      capsuleSafeRight: getCapsuleMetrics().safeRight,
      contentHeight: computeNavbarTabPageContentHeight(topSafeHeight).contentHeight
    })
    if (this.skipNextShow) {
      this.skipNextShow = false
      return
    }
    const now = Date.now()
    if (this.lastEntryLoadedAt && this.data.menuList.length > 0 && now - this.lastEntryLoadedAt < 15000) {
      this.syncIdentity()
      this.refreshCartCount()
      this.loadMenuMarks()
      return
    }
    this.runEntryLoad({ force: false, withOverlay: false })
  },

  async runEntryLoad(options = {}) {
    const withOverlay = !!options.withOverlay
    this.entryLoadTicket = (this.entryLoadTicket || 0) + 1
    const ticket = this.entryLoadTicket
    this.syncIdentity()
    this.setData({
      pageLoading: withOverlay,
      page: 1,
      hasMore: true
    })
    try {
      await this.refreshCategoryConfig()
      await this.refreshPairState()
      await this.loadMenuMarks()
      await this.loadMenuList()
      this.refreshCartCount()
      this.lastEntryLoadedAt = Date.now()
    } finally {
      if (ticket !== this.entryLoadTicket) return
      if (withOverlay) this.setData({ pageLoading: false })
    }
  },

  async refreshPairState() {
    try {
      const pair = await apiStore.getPairInfo()
      const isPaired = !!(pair && pair.isPaired)
      this.setData({
        isPaired,
        ownerFilter: isPaired ? this.data.ownerFilter : ''
      })
    } catch (err) {
      this.setData({ isPaired: false, ownerFilter: '' })
    }
  },

  syncIdentity() {
    const identity = apiStore.getWxIdentity() || {}
    this.setData({ selfUserId: String(identity.userId || '') })
  },

  async refreshCategoryConfig() {
    try {
      const list = await apiStore.getMenuCategories()
      const source = Array.isArray(list) ? list : []
      const categoryMap = {}
      const categoryList = source.map((it) => {
        const key = String((it && it.key) || '').trim()
        const label = String((it && it.label) || '').trim() || key
        if (key) categoryMap[key] = label
        return { key, label }
      }).filter((it) => it.key)
      if (app.globalData) app.globalData.menuCategoryMap = categoryMap
      this.setData({ categoryMap, categoryList })
    } catch (err) {
      const categoryMap = app.globalData ? app.globalData.menuCategoryMap : this.data.categoryMap
      const categoryList = Object.keys(categoryMap || {}).map((key) => ({
        key,
        label: this.resolveCategoryLabel(key, categoryMap)
      }))
      this.setData({ categoryMap, categoryList })
    }
  },

  async loadMenuMarks() {
    try {
      const [favorites, wishes] = await Promise.all([
        apiStore.getMenuMarks('favorite'),
        apiStore.getMenuMarks('wish')
      ])
      const favoriteMap = {}
      const wishMap = {}
      ;(favorites || []).forEach((item) => { favoriteMap[item.menuId] = true })
      ;(wishes || []).forEach((item) => { wishMap[item.menuId] = true })
      this.setData({ favoriteMap, wishMap })
    } catch (err) {
      // keep current marks when the network is unavailable
    }
  },

  resolveCategoryLabel(itemOrKey, map = {}) {
    if (itemOrKey && typeof itemOrKey === 'object') {
      const directLabel = String(itemOrKey.categoryLabel || '').trim()
      if (directLabel) return directLabel
    }
    const rawKey = String((itemOrKey && itemOrKey.category) || itemOrKey || '').trim()
    const fromMap = String((map && map[rawKey]) || '').trim()
    if (fromMap) return fromMap
    if (rawKey.startsWith('custom_')) {
      const readable = rawKey.replace(/^custom_/, '').replace(/_/g, ' ').trim()
      return readable || '自定义分类'
    }
    return rawKey || '未分类'
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadMenuList(() => wx.stopPullDownRefresh())
  },

  onListScrollToLower() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  onListRefresh() {
    if (this.data.loading) return
    this.setData({ refresherTriggered: true, page: 1, hasMore: true })
    this.loadMenuList(() => {
      this.setData({ refresherTriggered: false })
    })
  },

  async loadMenuList(callback) {
    this.setData({ loading: true })
    try {
      const res = await apiStore.getMenuList({
        category: this.data.currentCategory,
        keyword: this.data.keyword,
        available: true,
        page: this.data.page,
        pageSize: this.data.pageSize,
        owner: this.data.ownerFilter === 'me' ? 'self' : this.data.ownerFilter === 'ta' ? 'partner' : ''
      })

      const rawList = this.data.page === 1 ? res.list : [...this.data.menuList, ...res.list]
      const listWithOwnerRole = (Array.isArray(rawList) ? rawList : []).map((item) => ({
        ...(item || {}),
        ownerRole: String(item && item.owner) === String(this.data.selfUserId) ? 'me' : 'ta',
        ownerDisplayName: String((item && item.ownerName) || '').trim() || (String(item && item.owner) === String(this.data.selfUserId) ? '我' : '对方'),
        ownerDisplayAvatar: String((item && item.ownerAvatar) || '').trim(),
        categoryDisplay: this.resolveCategoryLabel(item, this.data.categoryMap)
      }))
      const list = listWithOwnerRole

      this.setData({
        menuList: list,
        hasMore: res.hasMore,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载菜单失败', icon: 'none' })
    }

    if (typeof callback === 'function') callback()
  },

  getFilteredMenuList(list = []) {
    const source = Array.isArray(list) ? list : []
    if (!this.data.isPaired) return source
    const owner = this.data.ownerFilter
    if (!owner) return source
    return source.filter((item) => item && item.ownerRole === owner)
  },

  loadMore() {
    this.setData({ page: this.data.page + 1 })
    this.loadMenuList()
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
    clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => {
      this.setData({ page: 1, hasMore: true })
      this.loadMenuList()
    }, 250)
  },

  filterCategory(e) {
    const category = e.currentTarget.dataset.category
    if (category === this.data.currentCategory) return

    this.setData({
      currentCategory: category,
      page: 1,
      hasMore: true
    })
    this.loadMenuList()
  },

  filterOwner(e) {
    const owner = e.currentTarget.dataset.owner
    if (owner === this.data.ownerFilter) return
    this.setData({
      ownerFilter: owner,
      page: 1,
      hasMore: true
    })
    this.loadMenuList()
  },

  handleAdd() {
    wx.navigateTo({ url: '/pages/MenuAdd/MenuAdd' })
  },

  onMenuTap(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/MenuDetail/MenuDetail?id=${id}` })
  },

  addToCart(e) {
    const { id } = e.currentTarget.dataset
    const menu = this.data.menuList.find((m) => m._id === id)
    if (!menu) return

    const cart = cartStore.getCart()
    if (cart[id]) {
      cart[id].count += 1
    } else {
      cart[id] = { menu, count: 1 }
    }

    cartStore.setCart(cart)
    this.refreshCartCount()
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  cancelOrderItem(e) {
    const { id } = e.currentTarget.dataset
    const cart = cartStore.getCart()
    if (!cart[id]) return

    if (cart[id].count > 1) {
      cart[id].count -= 1
    } else {
      delete cart[id]
    }

    cartStore.setCart(cart)
    this.refreshCartCount()
    wx.showToast({ title: '已取消一份', icon: 'none' })
  },

  refreshCartCount() {
    const cart = cartStore.getCart()
    const cartCount = Object.values(cart).reduce((sum, item) => sum + Number(item.count || 0), 0)
    this.setData({ cartCount, cartMap: cart })
    this.refreshUnconfirmedCount()
  },

  async refreshUnconfirmedCount() {
    try {
      const res = await apiStore.getOrderList({ status: 'pending' })
      const list = Array.isArray(res) ? res : ((res && res.list) || [])
      this.setData({ unconfirmedCount: list.length })
    } catch (e) { this.setData({ unconfirmedCount: 0 }) }
  },

  goOrder() {
    wx.switchTab({ url: '/pages/Order/Order' })
  },

  goCandidates() {
    wx.navigateTo({ url: '/pages/Candidates/Candidates' })
  },

  async addToCandidate(e) {
    const id = String(e.currentTarget.dataset.id || '').trim()
    if (!id) return
    try {
      await apiStore.addCandidate(id)
      wx.showToast({ title: '已加入候选', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '加入候选失败', icon: 'none' })
    }
  },

  async toggleMenuMark(e) {
    const id = String(e.currentTarget.dataset.id || '')
    const kind = String(e.currentTarget.dataset.kind || '')
    if (!id || !['favorite', 'wish'].includes(kind)) return
    const key = kind === 'favorite' ? 'favoriteMap' : 'wishMap'
    const marked = !!this.data[key][id]
    try {
      if (marked) await apiStore.removeMenuMark(kind, id)
      else await apiStore.addMenuMark(kind, id)
      this.setData({ [`${key}.${id}`]: !marked })
      wx.showToast({ title: marked ? '已移除' : (kind === 'favorite' ? '已收藏' : '已加入想吃'), icon: 'none' })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  goMenuHistory() {
    wx.navigateTo({ url: '/pages/MenuHistory/MenuHistory' })
  },

  onShareAppMessage() {
    return buildSharePayload()
  },

  onShareTimeline() {
    return buildTimelinePayload()
  }
})
