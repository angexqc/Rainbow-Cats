const app = getApp()
const apiStore = require('../../utils/apiStore')
const { getTopSafeHeight } = require('../../utils/safeArea')

Page({
  data: {
    topSafeHeight: 0,
    orderId: '',
    order: null,
    isCreator: true,
    canCancel: false,
    canConfirm: false,
    canComplete: false,
    statusMap: app.globalData ? app.globalData.orderStatusMap : {
      pending: '待确认',
      confirmed: '已确认',
      completed: '已完成',
      cancelled: '已取消'
    }
  },

  onLoad(options) {
    const { id } = options
    this.setData({ orderId: id, topSafeHeight: getTopSafeHeight() })
    this.loadOrderDetail()
  },

  onShow() {
    if (this.data.orderId) this.loadOrderDetail()
  },

  async loadOrderDetail() {
    try {
      const order = await apiStore.getOrderById(this.data.orderId)
      if (!order) {
        wx.showToast({ title: '订单不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 500)
        return
      }

      order.totalCount = Number(order.totalCount || 0)
      order.liked = !!order.liked
      order.review = order.review || ''
      const pair = await apiStore.getPairInfo()
      const actorMap = this.buildActorMap(pair)
      order.timeline = (order.timeline || []).map((step, index, arr) => ({
        ...step,
        actorName: (actorMap[step.actorRole] && actorMap[step.actorRole].name) || step.actorName || '系统',
        actorAvatar: (actorMap[step.actorRole] && actorMap[step.actorRole].avatar) || '',
        actorInitial: this.getInitial(((actorMap[step.actorRole] && actorMap[step.actorRole].name) || step.actorName || '系')),
        timeStr: step.time ? apiStore.formatDate(step.time) : '',
        isLast: index === arr.length - 1
      }))

      const isCreator = order.creatorRole === 'me'
      const canCancel = ['pending', 'confirmed'].includes(order.status)
      const canConfirm = order.status === 'pending'
      const canComplete = order.status === 'confirmed'

      this.setData({ order, isCreator, canCancel, canConfirm, canComplete })
    } catch (err) {
      wx.showToast({ title: '加载订单失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
    }
  },

  handleCancel() {
    wx.showModal({
      title: '确认取消订单',
      content: '取消后该订单将不可继续处理。',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await apiStore.updateOrderStatus(this.data.orderId, 'cancel')
          wx.showToast({ title: '已取消', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  },

  handleConfirm() {
    wx.showModal({
      title: '确认订单',
      content: '确认后订单状态将变为已确认。',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await apiStore.updateOrderStatus(this.data.orderId, 'confirm')
          wx.showToast({ title: '已确认', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  },

  handleComplete() {
    wx.showModal({
      title: '完成订单',
      content: '确认订单已完成？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await apiStore.updateOrderStatus(this.data.orderId, 'complete')
          wx.showToast({ title: '已完成', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  },

  async toggleLike() {
    const order = this.data.order
    if (!order) return
    try {
      await apiStore.setOrderFeedback(this.data.orderId, { liked: !order.liked })
      this.loadOrderDetail()
    } catch (err) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },

  editReview() {
    const order = this.data.order
    if (!order) return

    wx.showModal({
      title: '评价订单',
      editable: true,
      placeholderText: '输入你的评价（最多50字）',
      content: order.review || '',
      success: async (res) => {
        if (!res.confirm) return
        const text = (res.content || '').trim().slice(0, 50)
        try {
          await apiStore.setOrderFeedback(this.data.orderId, { review: text })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: '更新失败', icon: 'none' })
        }
      }
    })
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

  handleNoop() {},

  handleBack() {
    wx.navigateBack()
  }
})
