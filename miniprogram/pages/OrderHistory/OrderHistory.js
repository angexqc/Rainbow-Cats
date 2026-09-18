const app = getApp()
const apiStore = require('../../utils/apiStore')
const { getTopSafeHeight } = require('../../utils/safeArea')
const { buildSharePayload, buildTimelinePayload } = require('../../utils/share')

Page({
  data: {
    topSafeHeight: 0,
    windowHeight: 0,
    screenHeight: 0,
    tabBarHeight: 0,
    contentHeight: 0,
    orderList: [],
    currentStatus: '',
    loading: false,
    hasMore: true,
    refresherTriggered: false,
    page: 1,
    pageSize: app.globalData ? app.globalData.PAGE_SIZE_ORDER : 15,
    statusMap: app.globalData ? app.globalData.orderStatusMap : {
      pending: '待确认',
      confirmed: '已确认',
      completed: '已完成',
      cancelled: '已取消'
    }
  },

  onLoad() {
    this.lastOrderLoadedAt = 0
    const topSafeHeight = getTopSafeHeight()
    const metrics = this.getViewportMetrics()
    this.setData({
      topSafeHeight,
      windowHeight: metrics.windowHeight,
      screenHeight: metrics.screenHeight,
      tabBarHeight: metrics.tabBarHeight,
      contentHeight: this.computeContentHeight(topSafeHeight, metrics)
    })
    this.loadOrderList({ force: true })
  },

  onShow() {
    const topSafeHeight = Number(this.data.topSafeHeight || getTopSafeHeight())
    const metrics = this.getViewportMetrics()
    this.setData({
      windowHeight: metrics.windowHeight,
      screenHeight: metrics.screenHeight,
      tabBarHeight: metrics.tabBarHeight,
      contentHeight: this.computeContentHeight(topSafeHeight, metrics)
    })
    const now = Date.now()
    if (this.lastOrderLoadedAt && this.data.orderList.length > 0 && now - this.lastOrderLoadedAt < 15000) {
      return
    }
    this.setData({ page: 1, hasMore: true })
    this.loadOrderList({ force: false })
  },

  getViewportMetrics() {
    try {
      const fallback = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
      if (wx.getWindowInfo) {
        const info = wx.getWindowInfo() || {}
        return this.normalizeViewportMetrics(info)
      }
      return this.normalizeViewportMetrics(fallback)
    } catch (err) {
      return {
        windowHeight: 0,
        screenHeight: 0,
        tabBarHeight: 56
      }
    }
  },

  normalizeViewportMetrics(info = {}) {
    const screenHeight = Number(info.screenHeight || 0)
    const windowHeight = Number(info.windowHeight || 0)
    const statusBarHeight = Number(info.statusBarHeight || 0)
    const safeArea = info.safeArea || {}
    const safeBottomInset = Math.max(0, screenHeight - Number(safeArea.bottom || screenHeight || 0))
    const inferredTabBarHeight = Math.max(0, screenHeight - windowHeight - statusBarHeight)
    const fallbackTabBarHeight = 50 + safeBottomInset
    const tabBarHeight = inferredTabBarHeight > 20 ? inferredTabBarHeight : fallbackTabBarHeight

    return {
      windowHeight,
      screenHeight,
      tabBarHeight
    }
  },

  computeContentHeight(topSafeHeight, metrics = {}) {
    const screenHeight = Number(metrics.screenHeight || this.data.screenHeight || 0)
    const tabBarHeight = Number(metrics.tabBarHeight || this.data.tabBarHeight || 0)
    const headerHeight = Number(topSafeHeight || 0) + 64
    const baseHeight = screenHeight > 0 ? screenHeight : Number(metrics.windowHeight || this.data.windowHeight || 0)
    const nextHeight = baseHeight - headerHeight - tabBarHeight
    return nextHeight > 0 ? nextHeight : 0
  },

  onListScrollToLower() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  onListRefresh() {
    if (this.data.loading) return
    this.setData({ refresherTriggered: true, page: 1, hasMore: true })
    this.loadOrderList(() => {
      this.setData({ refresherTriggered: false })
    })
  },

  async loadOrderList(options = {}, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    this.setData({ loading: true })
    try {
      const pair = await apiStore.getPairInfo()
      const identity = apiStore.getWxIdentity() || {}
      const actorMap = this.buildActorMap(pair)

      const res = await apiStore.getOrderList({
        status: this.data.currentStatus,
        page: this.data.page,
        pageSize: this.data.pageSize
      })

      const list = res.list.map((order) => ({
        ...order,
        creatorRole: this.resolveOrderCreatorRole(order, identity, actorMap),
        displayOrderNo: String(order.orderNo || '').trim() || apiStore.buildOrderNo({
          userId: String(order.creatorUserId || '').trim()
        }, order.date || Date.now()),
        dateStr: apiStore.formatDate(order.date),
        itemsText: this.formatItems(order.items),
        totalCount: Number(order.totalCount || 0),
        liked: !!order.liked,
        review: order.review || '',
        timeline: this.formatTimeline(order, actorMap, identity)
      }))

      this.setData({
        orderList: this.data.page === 1 ? list : [...this.data.orderList, ...list],
        hasMore: res.hasMore,
        loading: false
      })
      this.lastOrderLoadedAt = Date.now()
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载订单失败', icon: 'none' })
    }

    if (typeof callback === 'function') callback()
  },

  loadMore() {
    this.setData({ page: this.data.page + 1 })
    this.loadOrderList()
  },

  filterStatus(e) {
    const status = e.currentTarget.dataset.status
    if (status === this.data.currentStatus) return

    this.setData({
      currentStatus: status,
      orderList: [],
      page: 1,
      hasMore: true
    })
    this.loadOrderList()
  },

  formatItems(items) {
    if (!items || !items.length) return ''
    return items.map((item) => `${item.title} x${item.count}`).join('，')
  },

  formatTimeline(order, actorMap, identity) {
    const timeline = Array.isArray(order && order.timeline) ? order.timeline : []
    const total = timeline.length
    const creatorRole = this.resolveOrderCreatorRole(order, identity, actorMap)
    return timeline.map((node, index) => {
      const actorRole = this.resolveTimelineActorRole(node, creatorRole, identity, actorMap)
      const actor = this.resolveTimelineActorDisplay(node, actorRole, actorMap)
      return ({
      ...node,
      actorRole,
      done: true,
      timeStr: node.time ? apiStore.formatDate(node.time) : '',
      actorName: actor.name,
      actorAvatar: actor.avatar,
      actorInitial: this.getInitial(actor.name),
      isLast: index === total - 1,
      isOnly: total === 1
      })
    })
  },

  resolveOrderCreatorRole(order = {}, identity = {}, actorMap = {}) {
    const selfUserId = String(identity.userId || '').trim()
    const creatorUserId = String(order.creatorUserId || order.userId || '').trim()
    if (creatorUserId && selfUserId) {
      return creatorUserId === selfUserId ? 'me' : 'ta'
    }

    const creatorName = String(order.creatorName || (order.timeline && order.timeline[0] && order.timeline[0].actorName) || '').trim()
    const roleByName = this.resolveRoleByName(creatorName, actorMap)
    if (roleByName) return roleByName

    const explicitRole = String(order.creatorRole || '').trim()
    if (explicitRole === 'me' || explicitRole === 'ta') return explicitRole

    return 'me'
  },

  resolveTimelineActorRole(node = {}, creatorRole = 'me', identity = {}, actorMap = {}) {
    const selfUserId = String(identity.userId || '').trim()
    const actorUserId = String(node.actorUserId || node.userId || '').trim()
    if (actorUserId && selfUserId) {
      return actorUserId === selfUserId ? 'me' : 'ta'
    }

    const roleByName = this.resolveRoleByName(node.actorName, actorMap)
    if (roleByName) return roleByName

    const explicitRole = String(node.actorRole || '').trim()
    if (explicitRole === 'me' || explicitRole === 'ta' || explicitRole === 'system') return explicitRole

    const status = String(node.status || '').trim()
    if (status === 'pending') return creatorRole
    if (status === 'confirmed' || status === 'completed') return creatorRole === 'me' ? 'ta' : 'me'
    if (status === 'cancelled') return creatorRole
    return 'system'
  },

  resolveRoleByName(name, actorMap = {}) {
    const text = String(name || '').trim()
    if (!text) return ''
    if (actorMap.ta && actorMap.ta.name && text === actorMap.ta.name) return 'ta'
    if (actorMap.me && actorMap.me.name && text === actorMap.me.name) return 'me'
    return ''
  },

  resolveTimelineActorDisplay(node = {}, actorRole = 'system', actorMap = {}) {
    const rawName = String(node.actorName || '').trim()
    const rawAvatar = String(node.actorAvatar || '').trim()
    const mapped = actorMap[actorRole] || {}
    return {
      name: rawName || mapped.name || '系统',
      avatar: rawAvatar || mapped.avatar || ''
    }
  },

  buildActorMap(pair) {
    const myInfo = (pair && pair.myInfo) || {}
    const partnerInfo = (pair && pair.partnerInfo) || {}
    return {
      me: { name: myInfo.nickName || '我', avatar: myInfo.avatarUrl || '' },
      ta: { name: partnerInfo.nickName || 'TA', avatar: partnerInfo.avatarUrl || '' },
      system: { name: '系统', avatar: '' }
    }
  },

  getInitial(name) {
    const text = String(name || '').trim()
    return text ? text.slice(0, 1) : '系'
  },

  viewOrderDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/OrderDetail/OrderDetail?id=${id}` })
  },

  async toggleLike(e) {
    const { id } = e.currentTarget.dataset
    const current = this.data.orderList.find((it) => it._id === id)
    if (!current) return
    try {
      await apiStore.setOrderFeedback(id, { liked: !current.liked })
      this.loadOrderList()
    } catch (err) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },

  editReview(e) {
    const { id } = e.currentTarget.dataset
    const current = this.data.orderList.find((it) => it._id === id)
    if (!current) return

    wx.showModal({
      title: '评价订单',
      editable: true,
      placeholderText: '输入你的评价（最多200字）',
      content: current.review || '',
      success: async (res) => {
        if (!res.confirm) return
        const text = (res.content || '').trim().slice(0, 200)
        try {
          await apiStore.setOrderFeedback(id, { review: text })
          this.loadOrderList()
        } catch (err) {
          wx.showToast({ title: '更新失败', icon: 'none' })
        }
      }
    })
  },

  handleNoop() {},

  handleBack() {
    wx.navigateBack()
  },

  onShareAppMessage() {
    return buildSharePayload()
  },

  onShareTimeline() {
    return buildTimelinePayload()
  }
})
