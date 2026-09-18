const apiStore = require('../../utils/apiStore')
const cartStore = require('../../utils/cartStore')
const { getContentTopSafeHeight, computeTopSafeTabPageContentHeight } = require('../../utils/safeArea')
const { buildSharePayload, buildTimelinePayload } = require('../../utils/share')

Page({
  data: {
    topSafeHeight: 0,
    contentHeight: 0,
    banners: [],
    heroCurrent: 0,
    isPaired: false,
    myInfo: {
      nickName: '我',
      avatarUrl: ''
    },
    partnerInfo: {
      nickName: '待配对',
      avatarUrl: ''
    },
    coupleCartCount: 0,
    candidateCount: 0,
    matchedCandidateCount: 0,
    pendingOrderCount: 0,
    pendingOrder: null,
    lastSyncText: '',
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
    this.skipNextShow = true
    this.lastHomeLoadedAt = 0
    this.lastRankingLoadedAt = 0
    this.lastRankingPeriod = ''
    this.setupViewport()
    this.loadHomeData({ force: true })
    this.refreshCartMap()
  },

  setupViewport() {
    const topSafeHeight = getContentTopSafeHeight()
    const metrics = computeTopSafeTabPageContentHeight()
    this.setData({
      topSafeHeight,
      contentHeight: Number(metrics.contentHeight || 0)
    })
  },

  onShow() {
    this.setupViewport()
    if (this.skipNextShow) {
      this.skipNextShow = false
      return
    }
    this.loadHomeData({ force: false })
    this.refreshCartMap()
  },

  async loadHomeData(options = {}) {
    const force = !!options.force
    const now = Date.now()
    if (!force && this.lastHomeLoadedAt && (now - this.lastHomeLoadedAt < 15000)) {
      return
    }
    try {
      const [pair, banners, popularDish, candidates, orders] = await Promise.all([
        apiStore.getPairInfo(),
        apiStore.getHomeBanners(),
        apiStore.getMostPopularDish(),
        apiStore.getCandidates(),
        apiStore.getOrderList({ status: 'pending', page: 1, pageSize: 3 })
      ])
      const pendingOrders = Array.isArray(orders && orders.list) ? orders.list : []
      const nowText = new Date().toTimeString().slice(0, 5)

      this.setData({
        banners,
        isPaired: pair.isPaired,
        myInfo: pair.myInfo || this.data.myInfo,
        partnerInfo: pair.partnerInfo || this.data.partnerInfo,
        popularDish,
        candidateCount: Array.isArray(candidates) ? candidates.length : 0,
        matchedCandidateCount: Array.isArray(candidates)
          ? candidates.filter((item) => item.result === 'recommended' || item.result === 'possible').length
          : 0,
        pendingOrderCount: Number(orders && orders.total || pendingOrders.length),
        pendingOrder: pendingOrders[0] || null,
        lastSyncText: `${nowText} 已同步`
      })

      await this.loadRanking(this.data.period, { force: force })
      this.lastHomeLoadedAt = Date.now()
    } catch (err) {
      wx.showToast({ title: '首页数据加载失败', icon: 'none' })
    }
  },

  async loadRanking(period, options = {}) {
    const force = !!options.force
    const now = Date.now()
    if (!force && this.lastRankingPeriod === period && this.lastRankingLoadedAt && (now - this.lastRankingLoadedAt < 15000)) {
      return
    }
    const rankingList = await apiStore.getDishRanking(period, 5)
    this.setData({ period, rankingList })
    this.lastRankingPeriod = period
    this.lastRankingLoadedAt = Date.now()
  },

  switchPeriod(e) {
    const { period } = e.currentTarget.dataset
    if (!period || period === this.data.period) return
    this.loadRanking(period, { force: true })
  },

  onHeroChange(e) {
    this.setData({ heroCurrent: Number(e.detail.current || 0) })
  },

  refreshCartMap() {
    const cart = cartStore.getCart()
    const coupleCartCount = Object.values(cart).reduce((sum, item) => sum + Number(item && item.count || 0), 0)
    this.setData({ cartMap: cart, coupleCartCount })
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

    const cart = cartStore.getCart()
    if (cart[menu._id]) {
      cart[menu._id].count += 1
    } else {
      cart[menu._id] = { menu, count: 1 }
    }
    cartStore.setCart(cart)
    this.setData({ cartMap: cart })
  },

  decreaseDish(e) {
    const { id } = e.currentTarget.dataset
    const cart = cartStore.getCart()
    if (!cart[id]) return
    if (cart[id].count > 1) {
      cart[id].count -= 1
    } else {
      delete cart[id]
    }
    cartStore.setCart(cart)
    this.setData({ cartMap: cart })
  },

  goPair() {
    wx.navigateTo({ url: '/pages/Pair/Pair' })
  },

  goOrder() {
    wx.switchTab({ url: '/pages/Order/Order' })
  },

  goMenu() {
    wx.switchTab({ url: '/pages/Menu/Menu' })
  },

  goWheel() {
    wx.navigateTo({ url: '/pages/OrderWheel/OrderWheel' })
  },

  goCandidates() {
    wx.navigateTo({ url: '/pages/Candidates/Candidates' })
  },

  goPendingOrder() {
    if (this.data.pendingOrder && this.data.pendingOrder._id) {
      wx.navigateTo({ url: `/pages/OrderDetail/OrderDetail?id=${this.data.pendingOrder._id}` })
      return
    }
    wx.switchTab({ url: '/pages/OrderHistory/OrderHistory' })
  },

  onShareAppMessage() {
    return buildSharePayload()
  },

  onShareTimeline() {
    return buildTimelinePayload()
  }
})
