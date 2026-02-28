const apiStore = require('./utils/apiStore')
const { setAuthExpiredHandler } = require('./services/http')

App({
  onLaunch() {
    apiStore.ensureMockDB()
    apiStore.bootstrapSession().catch(() => {})

    this.globalData = {
      // 默认走 Node API；网络不可用时 apiStore 会回退到本地 mockStore。
      // 可通过 wx.setStorageSync('apiBaseUrl', 'http://127.0.0.1:3100/api') 自定义接口地址。
      currentUserRole: 'me',
      partnerUserRole: 'ta',
      menuCategoryMap: {
        main: '主食',
        drink: '饮品',
        dessert: '甜点',
        other: '其他'
      },
      orderStatusMap: {
        pending: '待确认',
        confirmed: '已确认',
        completed: '已完成',
        cancelled: '已取消'
      },
      PAGE_SIZE_MENU: 20,
      PAGE_SIZE_ORDER: 15,
      lastAuthExpiredNotifyTs: 0
    }

    setAuthExpiredHandler(() => {
      const now = Date.now()
      const lastTs = Number(this.globalData.lastAuthExpiredNotifyTs || 0)
      if (now - lastTs > 3000) {
        wx.showToast({
          title: '登录失效，请重新进入',
          icon: 'none'
        })
        this.globalData.lastAuthExpiredNotifyTs = now
      }
      wx.switchTab({ url: '/pages/Home/index' })
    })
  }
})
