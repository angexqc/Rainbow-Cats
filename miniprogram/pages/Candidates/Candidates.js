const apiStore = require('../../utils/apiStore')
const cartStore = require('../../utils/cartStore')
const { getTopSafeHeight } = require('../../utils/safeArea')

Page({
  data: {
    topSafeHeight: 0,
    loading: false,
    candidates: [],
    lastSyncText: '',
    choiceOptions: [
      { key: 'want', label: '想吃' },
      { key: 'neutral', label: '都可以' },
      { key: 'avoid', label: '今天不想吃' }
    ],
    choiceMap: { want: '想吃', neutral: '都可以', avoid: '今天不想吃' },
    resultMap: { recommended: '默契菜单', possible: '可以考虑', pending: '等 TA 选择', excluded: '暂不考虑' }
  },

  onLoad() {
    this.setData({ topSafeHeight: getTopSafeHeight() })
    this.loadCandidates()
  },

  onShow() {
    if (this.data.candidates.length) this.loadCandidates({ silent: true })
    this.startPolling()
  },

  onHide() {
    this.stopPolling()
  },

  onUnload() {
    this.stopPolling()
  },

  onPullDownRefresh() {
    this.loadCandidates().finally(() => wx.stopPullDownRefresh())
  },

  async loadCandidates(options = {}) {
    if (this.loadingCandidates) return
    this.loadingCandidates = true
    if (!options.silent) this.setData({ loading: true })
    try {
      const candidates = await apiStore.getCandidates()
      const now = new Date()
      this.setData({
        candidates: Array.isArray(candidates) ? candidates : [],
        lastSyncText: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} 已同步`
      })
    } catch (err) {
      this.setData({ lastSyncText: '同步失败，显示上次结果' })
      if (!options.silent) wx.showToast({ title: '加载候选失败，可下拉重试', icon: 'none' })
    } finally {
      this.loadingCandidates = false
      if (!options.silent) this.setData({ loading: false })
    }
  },

  startPolling() {
    this.stopPolling()
    this.pollTimer = setInterval(() => this.loadCandidates({ silent: true }), 20000)
  },

  stopPolling() {
    clearInterval(this.pollTimer)
    this.pollTimer = null
  },

  handleBack() {
    wx.navigateBack()
  },

  async choose(e) {
    const id = String(e.currentTarget.dataset.id || '')
    const choice = String(e.currentTarget.dataset.choice || '')
    if (!id || !choice) return
    try {
      const updated = await apiStore.voteCandidate(id, choice)
      const candidates = this.data.candidates.map((item) => item.id === id ? updated : item)
      this.setData({ candidates })
    } catch (err) {
      wx.showToast({ title: '选择更新失败', icon: 'none' })
    }
  },

  async remove(e) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id) return
    try {
      await apiStore.removeCandidate(id)
      this.setData({ candidates: this.data.candidates.filter((item) => item.id !== id) })
    } catch (err) {
      wx.showToast({ title: '移除失败', icon: 'none' })
    }
  },

  addToCart(e) {
    const id = String(e.currentTarget.dataset.id || '')
    const candidate = this.data.candidates.find((item) => item.id === id)
    if (!candidate || !candidate.menu || !candidate.menu.available) {
      wx.showToast({ title: '菜品已下架', icon: 'none' })
      return
    }
    const cart = cartStore.getCart()
    const menu = candidate.menu
    if (cart[menu._id]) cart[menu._id].count = Number(cart[menu._id].count || 0) + 1
    else cart[menu._id] = { menu, count: 1 }
    cartStore.setCart(cart)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  addMatchesToCart() {
    const selected = this.data.candidates.filter((item) =>
      item.menu && item.menu.available && (item.result === 'recommended' || item.result === 'possible'))
    if (!selected.length) {
      wx.showToast({ title: '还没有共同选择', icon: 'none' })
      return
    }
    const cart = cartStore.getCart()
    selected.forEach((candidate) => {
      const menu = candidate.menu
      if (cart[menu._id]) cart[menu._id].count = Number(cart[menu._id].count || 0) + 1
      else cart[menu._id] = { menu, count: 1 }
    })
    cartStore.setCart(cart)
    wx.showToast({ title: `已加入 ${selected.length} 道`, icon: 'success' })
    setTimeout(() => wx.switchTab({ url: '/pages/Order/Order' }), 350)
  }
})
