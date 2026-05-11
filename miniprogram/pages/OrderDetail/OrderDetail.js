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
      order.displayOrderNo = String(order.orderNo || '').trim() || apiStore.buildOrderNo({
        userId: String(order.creatorUserId || '').trim()
      }, order.date || Date.now())
      const identity = apiStore.getWxIdentity() || {}
      const pair = await apiStore.getPairInfo()
      const actorMap = this.buildActorMap(pair)
      order.creatorRole = this.resolveOrderCreatorRole(order, identity, actorMap)
      order.timeline = (order.timeline || []).map((step, index, arr) => {
        const actorRole = this.resolveTimelineActorRole(step, order.creatorRole, identity, actorMap)
        const actor = this.resolveTimelineActorDisplay(step, actorRole, actorMap)
        return ({
        ...step,
        actorRole,
        actorName: actor.name,
        actorAvatar: actor.avatar,
        actorInitial: this.getInitial(actor.name),
        timeStr: step.time ? apiStore.formatDate(step.time) : '',
        isLast: index === arr.length - 1
        })
      })

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

  handleReorder() {
    const order = this.data.order
    if (!order || !Array.isArray(order.items) || !order.items.length) {
      wx.showToast({ title: '该订单无可下单菜品', icon: 'none' })
      return
    }

    const cart = wx.getStorageSync('cart') || {}
    const fallbackSeed = Date.now()
    order.items.forEach((item, idx) => {
      const menuId = String(item.menuId || item._id || '').trim() || `order_${this.data.orderId}_${fallbackSeed}_${idx}`
      const menu = {
        _id: menuId,
        title: item.title || '未知菜品',
        image: item.image || ''
      }
      const addCount = Math.max(1, Number(item.count || 0))
      if (cart[menuId]) {
        cart[menuId].count = Number(cart[menuId].count || 0) + addCount
      } else {
        cart[menuId] = { menu, count: addCount }
      }
    })

    wx.setStorageSync('cart', cart)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
    setTimeout(() => {
      wx.switchTab({ url: '/pages/Order/Order' })
    }, 220)
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

  getInitial(name) {
    const text = String(name || '').trim()
    return text ? text.slice(0, 1) : '系'
  },

  handleNoop() {},

  handleBack() {
    wx.navigateBack()
  }
})
