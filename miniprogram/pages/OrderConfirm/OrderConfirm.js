const apiStore = require('../../utils/apiStore')
const cartStore = require('../../utils/cartStore')
const { getTopSafeHeight } = require('../../utils/safeArea')
const { getMenuConflicts } = require('../../utils/foodPreferenceRules')

Page({
  data: {
    topSafeHeight: 0,
    cart: {},
    cartItems: [],
    totalCount: 0,
    remark: '',
    loading: false,
    pair: null,
    notifyResultText: '下单前可选择开启通知',
    conflictTerms: []
  },

  onLoad() {
    this.setData({ loading: true, topSafeHeight: getTopSafeHeight() })
    this.loadCartFromStorage()
    this.loadCollaborationContext()
  },

  async loadCollaborationContext() {
    try {
      const pair = await apiStore.getPairInfo()
      this.setData({ pair })
    } catch (err) {
      this.setData({ pair: null })
    }
  },

  loadCartFromStorage() {
    try {
      const checkout = cartStore.getCheckout()
      const items = checkout && Array.isArray(checkout.items) ? checkout.items : []
      this.checkout = checkout
      this.setData({ cart: Object.fromEntries(items.map((item) => [item.menuId, { menu: item, count: item.count }])) })
      this.calculateTotal()
    } catch (err) {
      console.error('loadCartFromStorage error:', err)
      this.setData({ loading: false })
    }
  },

  calculateTotal() {
    const items = Object.values(this.data.cart)
      .filter((item) => item.menu && (item.menu._id || item.menu.menuId))
      .map((item) => ({
        menuId: item.menu._id || item.menu.menuId,
        title: item.menu.title,
        image: item.menu.image,
        count: Number(item.count),
        desc: item.menu.desc
      }))

    const totalCount = items.reduce((sum, item) => sum + item.count, 0)

    this.setData({
      cartItems: items,
      totalCount,
      loading: false
    })
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  handleBack() {
    wx.navigateBack()
  },

  async handleConfirm() {
    const { cartItems, remark, totalCount } = this.data

    if (!cartItems.length) {
      wx.showToast({ title: '请选择菜品', icon: 'none' })
      return
    }

    let preferences = []
    try {
      const [mine, partner] = await Promise.all([apiStore.getFoodPreferences(), apiStore.getPartnerFoodPreferences()])
      preferences = [mine, partner && partner.shared !== false ? partner : null]
    } catch (err) {
      preferences = []
    }
    const conflictTerms = [...new Set(cartItems.reduce((all, item) => all.concat(getMenuConflicts(item, preferences)), []))]
    this.setData({ conflictTerms })
    const warning = conflictTerms.length ? `检测到可能涉及：${conflictTerms.join('、')}。这只是偏好提醒，请自行确认。\n` : ''

    wx.showModal({
      title: '确认下单',
      content: `${warning}本次共 ${totalCount} 份菜品`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          const subscribeResult = await apiStore.requestOrderSubscribeAuthorization()
          if (subscribeResult.requested && !subscribeResult.accepted) {
            const message = subscribeResult.state === 'reject' ? '未开启通知，订单仍会正常创建' : '通知授权未成功，订单仍会正常创建'
            wx.showToast({ title: message, icon: 'none' })
          }
          this.setData({ notifyResultText: subscribeResult.accepted ? '已接受订单通知' : '未开启通知，订单仍会正常创建' })
          await apiStore.createOrder({
            items: cartItems,
            remark,
            idempotencyKey: this.checkout && this.checkout.idempotencyKey
          })
          cartStore.removeItems(cartItems.map((item) => item.menuId))
          cartStore.clearCheckout()
          wx.showToast({ title: '下单成功', icon: 'success' })

          setTimeout(() => {
            wx.switchTab({ url: '/pages/OrderHistory/OrderHistory' })
          }, 600)
        } catch (err) {
          this.setData({ notifyResultText: '下单失败，购物车已保留，可重试' })
          const bizCode = Number(err && err.bizCode)
          const message = bizCode === 12002
            ? '有菜品已下架，请返回购物车调整'
            : bizCode === 12001
              ? '有菜品已删除，请返回购物车调整'
              : bizCode === 13004
                ? '订单内容已变化，请返回后重新确认'
                : '下单失败，请稍后重试'
          wx.showToast({ title: message, icon: 'none' })
        }
      }
    })
  }
})
