const apiStore = require('../../utils/apiStore')

Page({
  data: {
    isPaired: false,
    pairCode: '',
    inputCode: '',
    partnerInfo: {
      nickName: '',
      avatarUrl: '',
      bindTime: ''
    }
  },

  onLoad() {
    this.loadPairInfo()
  },

  onShow() {
    this.loadPairInfo()
  },

  async loadPairInfo() {
    try {
      const pair = await apiStore.getPairInfo()
      this.setData({
        isPaired: pair.isPaired,
        pairCode: pair.pairCode,
        partnerInfo: pair.partnerInfo || {}
      })

      if (!pair.pairCode) {
        this.generatePairCode()
      }
    } catch (err) {
      wx.showToast({ title: '加载配对信息失败', icon: 'none' })
    }
  },

  async generatePairCode() {
    try {
      const code = await apiStore.generatePairCode()
      this.setData({ pairCode: code })
    } catch (err) {
      wx.showToast({ title: '生成配对码失败', icon: 'none' })
    }
  },

  onCodeInput(e) {
    this.setData({ inputCode: e.detail.value })
  },

  async handleBind() {
    const code = (this.data.inputCode || '').trim()
    if (code.length !== 6) {
      wx.showToast({ title: '请输入6位配对码', icon: 'none' })
      return
    }

    try {
      await apiStore.bindPair(code)
      wx.showToast({ title: '绑定成功', icon: 'success' })
      this.setData({ inputCode: '' })
      await this.loadPairInfo()
      setTimeout(() => {
        wx.switchTab({ url: '/pages/Home/index' })
      }, 300)
    } catch (err) {
      wx.showToast({ title: '绑定失败', icon: 'none' })
    }
  },

  handleUnbind() {
    wx.showModal({
      title: '确认解除绑定',
      content: '解除绑定后，双方将无法共享菜单和点单记录。',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await apiStore.unbindPair()
          wx.showToast({ title: '已解除绑定', icon: 'success' })
          this.loadPairInfo()
        } catch (err) {
          wx.showToast({ title: '解绑失败', icon: 'none' })
        }
      }
    })
  },

  handleBack() {
    wx.navigateBack()
  }
})
