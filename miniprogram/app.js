const apiStore = require('./utils/apiStore')
const { setAuthExpiredHandler } = require('./services/http')
const { buildSharePayload, buildTimelinePayload } = require('./utils/share')
const { selectApiBase } = require('./services/apiBase')

const DEFAULT_CATEGORY_MAP = {
  main: '主食',
  drink: '饮品',
  dessert: '甜点',
  other: '其他'
}
const NativePage = Page

function ensureGlobalShareMenus() {
  if (!wx || typeof wx.showShareMenu !== 'function') return
  try {
    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline']
    })
  } catch (err) {
    // ignore unsupported share menu errors
  }
}

Page = function registerSharedPage(pageOptions = {}) {
  const nextPageOptions = { ...pageOptions }
  const originalOnLoad = nextPageOptions.onLoad
  const originalOnShow = nextPageOptions.onShow

  nextPageOptions.onLoad = function wrappedOnLoad(...args) {
    ensureGlobalShareMenus()
    if (typeof originalOnLoad === 'function') {
      return originalOnLoad.apply(this, args)
    }
    return undefined
  }

  nextPageOptions.onShow = function wrappedOnShow(...args) {
    ensureGlobalShareMenus()
    if (typeof originalOnShow === 'function') {
      return originalOnShow.apply(this, args)
    }
    return undefined
  }

  if (typeof nextPageOptions.onShareAppMessage !== 'function') {
    nextPageOptions.onShareAppMessage = function onShareAppMessage() {
      return buildSharePayload()
    }
  }

  if (typeof nextPageOptions.onShareTimeline !== 'function') {
    nextPageOptions.onShareTimeline = function onShareTimeline() {
      return buildTimelinePayload()
    }
  }

  return NativePage(nextPageOptions)
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
    try {
      const currentApiBase = selectApiBase(wx.getStorageSync('apiBaseUrl') || '', wx)
      wx.setStorageSync('apiBaseUrl', currentApiBase)
    } catch (err) {
      wx.setStorageSync('apiBaseUrl', selectApiBase('', wx))
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
      const pages = getCurrentPages()
      const top = pages && pages.length ? pages[pages.length - 1] : null
      const route = top && top.route ? top.route : ''
      if (route === 'pages/Splash/index') {
        return
      }
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

    this.prepareLaunchState().catch(() => {})
  }
})
