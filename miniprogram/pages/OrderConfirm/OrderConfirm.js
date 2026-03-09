const apiStore = require('../../utils/apiStore')
const { getTopSafeHeight } = require('../../utils/safeArea')

Page({
  data: {
    topSafeHeight: 0,
    cart: {},
    cartItems: [],
    totalCount: 0,
    remark: '',
    loading: false
  },

  onLoad() {
    this.setData({ loading: true, topSafeHeight: getTopSafeHeight() })
    this.loadCartFromStorage()
  },

  loadCartFromStorage() {
    try {
      const cart = wx.getStorageSync('cart') || {}
      this.setData({ cart })
      this.calculateTotal()
    } catch (err) {
      console.error('loadCartFromStorage error:', err)
      this.setData({ loading: false })
    }
  },

  calculateTotal() {
    const items = Object.values(this.data.cart)
      .filter((item) => item.menu && item.menu.available)
      .map((item) => ({
        menuId: item.menu._id,
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

  handleConfirm() {
    const { cartItems, remark, totalCount } = this.data

    if (!cartItems.length) {
      wx.showToast({ title: '请选择菜品', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认下单',
      content: `本次共 ${totalCount} 份菜品`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          await apiStore.createOrder({ items: cartItems, remark })
          wx.setStorageSync('cart', {})
          wx.showToast({ title: '下单成功', icon: 'success' })

          setTimeout(() => {
            wx.switchTab({ url: '/pages/OrderHistory/OrderHistory' })
          }, 600)
        } catch (err) {
          wx.showToast({ title: '下单失败', icon: 'none' })
        }
      }
    })
  }
})
