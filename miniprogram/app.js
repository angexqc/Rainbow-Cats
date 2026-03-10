const apiStore = require('./utils/apiStore')
const { setAuthExpiredHandler } = require('./services/http')

const DEFAULT_CATEGORY_MAP = {
  main: '主食',
  drink: '饮品',
  dessert: '甜点',
  other: '其他'
}
const DEFAULT_API_BASE_URL = 'https://wubaihappyfood.top/api'

function normalizeApiBase(url) {
  const raw = String(url || '').trim().replace(/\/+$/, '')
  if (!raw) return ''
  if (/^http:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, 'https://')
  return raw
}

App({
  prepareLaunchState() {
    if (this.launchReadyPromise) return this.launchReadyPromise
    this.launchReadyPromise = (async () => {
      apiStore.ensureMockDB()
      await apiStore.bootstrapSession()
      const profileReady = await apiStore.ensureProfileReady()
      if (profileReady) {
        try {
          await apiStore.getPairInfo()
          await apiStore.syncMenuCategoryMapFromMenus({ force: true })
        } catch (err) {
          // ignore bootstrap sync errors
        }
      }
      return { profileReady }
    })()
    return this.launchReadyPromise
  },

  onLaunch() {
    this.prepareLaunchState().catch(() => {})
    try {
      const currentApiBase = normalizeApiBase(wx.getStorageSync('apiBaseUrl') || '')
      if (!currentApiBase) {
        wx.setStorageSync('apiBaseUrl', DEFAULT_API_BASE_URL)
      } else {
        wx.setStorageSync('apiBaseUrl', currentApiBase)
      }
    } catch (err) {
      wx.setStorageSync('apiBaseUrl', DEFAULT_API_BASE_URL)
    }
    this.globalData = {
      // 默认走 Node API；网络不可用时 apiStore 会回退到本地 mockStore。
      // 可通过 wx.setStorageSync('apiBaseUrl', 'http://127.0.0.1:3100/api') 自定义接口地址。
      currentUserRole: 'me',
      partnerUserRole: 'ta',
      menuCategoryMap: { ...DEFAULT_CATEGORY_MAP },
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
