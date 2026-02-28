const app = getApp()
const apiStore = require('../../utils/apiStore')

Page({
  data: {
    menuList: [],
    keyword: '',
    currentCategory: '',
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    cartCount: 0,
    cartMap: {},
    categoryMap: app.globalData ? app.globalData.menuCategoryMap : {
      main: '主食',
      drink: '饮品',
      dessert: '甜点',
      other: '其他'
    }
  },

  onLoad() {
    this.loadMenuList()
    this.refreshCartCount()
  },

  onShow() {
    this.setData({ page: 1, hasMore: true })
    this.loadMenuList()
    this.refreshCartCount()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadMenuList(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
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

      const list = this.data.page === 1 ? res.list : [...this.data.menuList, ...res.list]

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
