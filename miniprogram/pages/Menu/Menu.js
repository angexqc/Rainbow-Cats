const app = getApp()
const apiStore = require('../../utils/apiStore')
const { getTopSafeHeight } = require('../../utils/safeArea')

Page({
  data: {
    topSafeHeight: 0,
    menuList: [],
    keyword: '',
    currentCategory: '',
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    refresherTriggered: false,
    cartCount: 0,
    cartMap: {},
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
    this.setData({ topSafeHeight: getTopSafeHeight() })
    this.syncIdentity()
    this.refreshCategoryConfig()
    this.refreshPairState()
      .finally(() => this.loadMenuList())
    this.refreshCartCount()
  },

  async onShow() {
    this.syncIdentity()
    this.refreshCategoryConfig()
    await this.refreshPairState()
    this.setData({ page: 1, hasMore: true })
    this.loadMenuList()
    this.refreshCartCount()
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

  refreshCategoryConfig() {
    const categoryMap = app.globalData ? app.globalData.menuCategoryMap : this.data.categoryMap
    const categoryList = Object.keys(categoryMap || {}).map((key) => ({
      key,
      label: categoryMap[key]
    }))
    this.setData({ categoryMap, categoryList })
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
        pageSize: this.data.pageSize
      })

      const rawList = this.data.page === 1 ? res.list : [...this.data.menuList, ...res.list]
      const listWithOwnerRole = (Array.isArray(rawList) ? rawList : []).map((item) => ({
        ...item,
        ownerRole: String(item && item.owner) === String(this.data.selfUserId) ? 'me' : 'ta',
        ownerDisplayName: String(item && item.ownerName) || (String(item && item.owner) === String(this.data.selfUserId) ? '我' : '对方'),
        ownerDisplayAvatar: String(item && item.ownerAvatar) || ''
      }))
      const list = this.getFilteredMenuList(listWithOwnerRole)

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

    const cart = wx.getStorageSync('cart') || {}
    if (cart[id]) {
      cart[id].count += 1
    } else {
      cart[id] = { menu, count: 1 }
    }

    wx.setStorageSync('cart', cart)
    this.refreshCartCount()
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  cancelOrderItem(e) {
    const { id } = e.currentTarget.dataset
    const cart = wx.getStorageSync('cart') || {}
    if (!cart[id]) return

    if (cart[id].count > 1) {
      cart[id].count -= 1
    } else {
      delete cart[id]
    }

    wx.setStorageSync('cart', cart)
    this.refreshCartCount()
    wx.showToast({ title: '已取消一份', icon: 'none' })
  },

  refreshCartCount() {
    const cart = wx.getStorageSync('cart') || {}
    const cartCount = Object.values(cart).reduce((sum, item) => sum + Number(item.count || 0), 0)
    this.setData({ cartCount, cartMap: cart })
  },

  goOrder() {
    wx.switchTab({ url: '/pages/Order/Order' })
  }
})
