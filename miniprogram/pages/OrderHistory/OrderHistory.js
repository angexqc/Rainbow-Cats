const app = getApp()
const apiStore = require('../../utils/apiStore')

Page({
  data: {
    orderList: [],
    currentStatus: '',
    loading: false,
    hasMore: true,
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
    this.loadOrderList()
  },

  onShow() {
    this.setData({ page: 1, hasMore: true })
    this.loadOrderList()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadOrderList(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  async loadOrderList(callback) {
    this.setData({ loading: true })
    try {
      const pair = await apiStore.getPairInfo()
      const actorMap = this.buildActorMap(pair)

      const res = await apiStore.getOrderList({
        status: this.data.currentStatus,
        page: this.data.page,
        pageSize: this.data.pageSize
      })

      const list = res.list.map((order) => ({
        ...order,
        dateStr: apiStore.formatDate(order.date),
        itemsText: this.formatItems(order.items),
        totalCount: Number(order.totalCount || 0),
        liked: !!order.liked,
        review: order.review || '',
        timeline: this.formatTimeline(order.timeline || [], actorMap)
      }))

      this.setData({
        orderList: this.data.page === 1 ? list : [...this.data.orderList, ...list],
        hasMore: res.hasMore,
        loading: false
      })
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

  formatTimeline(timeline, actorMap) {
    return timeline.map((node, index) => ({
      ...node,
      done: true,
      timeStr: node.time ? apiStore.formatDate(node.time) : '',
      actorName: (actorMap[node.actorRole] && actorMap[node.actorRole].name) || node.actorName || '系统',
      actorAvatar: (actorMap[node.actorRole] && actorMap[node.actorRole].avatar) || '',
      actorInitial: this.getInitial(((actorMap[node.actorRole] && actorMap[node.actorRole].name) || node.actorName || '系')),
      isLast: index === timeline.length - 1
    }))
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
      placeholderText: '输入你的评价（最多50字）',
      content: current.review || '',
      success: async (res) => {
        if (!res.confirm) return
        const text = (res.content || '').trim().slice(0, 50)
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
  }
})
