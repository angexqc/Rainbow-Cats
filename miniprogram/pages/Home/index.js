const apiStore = require('../../utils/apiStore')

Page({
  data: {
    topSafeHeight: 0,
    banners: [],
    isPaired: false,
    myInfo: {
      nickName: '我',
      avatarUrl: ''
    },
    partnerInfo: {
      nickName: '待配对',
      avatarUrl: ''
    },
    period: 'week',
    rankPeriods: [
      { key: 'week', label: '周榜' },
      { key: 'month', label: '月榜' },
      { key: 'year', label: '年榜' }
    ],
    rankingList: [],
    popularDish: null,
    cartMap: {}
  },

  onLoad() {
    this.setupTopSafeArea()
    this.loadHomeData()
    this.refreshCartMap()
  },

  setupTopSafeArea() {
    let topSafeHeight = 0
    try {
      const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
      const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
      if (menu && menu.bottom) {
        topSafeHeight = menu.bottom + 8
      } else {
        const status = Number(sys.statusBarHeight || 20)
        topSafeHeight = status + 40
      }
    } catch (err) {
      topSafeHeight = 52
    }
    this.setData({ topSafeHeight })
  },

  onShow() {
    this.loadHomeData()
    this.refreshCartMap()
  },

  async loadHomeData() {
    try {
      const [pair, banners, popularDish] = await Promise.all([
        apiStore.getPairInfo(),
        apiStore.getHomeBanners(),
        apiStore.getMostPopularDish()
      ])

      this.setData({
        banners,
        isPaired: pair.isPaired,
        myInfo: pair.myInfo || this.data.myInfo,
        partnerInfo: pair.partnerInfo || this.data.partnerInfo,
        popularDish
      })

      await this.loadRanking(this.data.period)
    } catch (err) {
      wx.showToast({ title: '首页数据加载失败', icon: 'none' })
    }
  },

  async loadRanking(period) {
    const rankingList = await apiStore.getDishRanking(period, 5)
    this.setData({ period, rankingList })
  },

  switchPeriod(e) {
    const { period } = e.currentTarget.dataset
    if (!period || period === this.data.period) return
    this.loadRanking(period)
  },

  refreshCartMap() {
    const cart = wx.getStorageSync('cart') || {}
    this.setData({ cartMap: cart })
  },

  async getMenuFromDish(dish) {
    if (!dish || !dish.menuId) return null
    const menu = await apiStore.getMenuById(dish.menuId)
    if (menu) return menu
    return {
      _id: dish.menuId,
      title: dish.title || '未知菜品',
      image: dish.image || '',
      desc: '',
      category: dish.category || 'other',
      owner: 'me',
      available: true
    }
  },

  async increaseDish(e) {
    const { id, source } = e.currentTarget.dataset
    let dish = null
    if (source === 'popular') {
      dish = this.data.popularDish
    } else {
      dish = this.data.rankingList.find((it) => it.menuId === id)
    }

    const menu = await this.getMenuFromDish(dish)
    if (!menu) return

    const cart = wx.getStorageSync('cart') || {}
    if (cart[menu._id]) {
      cart[menu._id].count += 1
    } else {
      cart[menu._id] = { menu, count: 1 }
    }
    wx.setStorageSync('cart', cart)
    this.setData({ cartMap: cart })
  },

  decreaseDish(e) {
    const { id } = e.currentTarget.dataset
    const cart = wx.getStorageSync('cart') || {}
    if (!cart[id]) return
    if (cart[id].count > 1) {
      cart[id].count -= 1
    } else {
      delete cart[id]
    }
    wx.setStorageSync('cart', cart)
    this.setData({ cartMap: cart })
  },

  goPair() {
    wx.navigateTo({ url: '/pages/Pair/Pair' })
  },

  goOrder() {
    wx.switchTab({ url: '/pages/Order/Order' })
  }
})
