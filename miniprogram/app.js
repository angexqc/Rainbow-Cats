const apiStore = require('./utils/apiStore')
const { setAuthExpiredHandler } = require('./services/http')

const DEFAULT_CATEGORY_MAP = {
  main: '主食',
  drink: '饮品',
  dessert: '甜点',
  other: '其他'
}
const DEFAULT_API_BASE_URL = 'https://wubaihappyfood.top/api'
const CATEGORY_ORDER_KEY = 'menuCategoryOrder'

function loadCategoryMap() {
  let merged = { ...DEFAULT_CATEGORY_MAP }
  try {
    const fromStorage = wx.getStorageSync('menuCategoryMap')
    if (fromStorage && typeof fromStorage === 'object') {
      merged = { ...DEFAULT_CATEGORY_MAP, ...fromStorage }
    }
  } catch (err) {
    // ignore storage exceptions
  }

  let orderedKeys = []
  try {
    const fromOrder = wx.getStorageSync(CATEGORY_ORDER_KEY)
    if (Array.isArray(fromOrder)) {
      orderedKeys = fromOrder
        .map((k) => String(k || '').trim())
        .filter((k) => k && Object.prototype.hasOwnProperty.call(merged, k))
    }
  } catch (err) {
    orderedKeys = []
  }

  Object.keys(merged).forEach((key) => {
    if (!orderedKeys.includes(key)) orderedKeys.push(key)
  })

  const orderedMap = {}
  orderedKeys.forEach((key) => {
    orderedMap[key] = merged[key]
  })
  return orderedMap
}

function normalizeApiBase(url) {
  const raw = String(url || '').trim().replace(/\/+$/, '')
  if (!raw) return ''
  if (/^http:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, 'https://')
  return raw
}

App({
  onLaunch() {
    apiStore.ensureMockDB()
    apiStore.bootstrapSession()
      .then(() => apiStore.ensureProfileReady())
      .then(async (profileReady) => {
        if (!profileReady) {
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/ProfileSetup/index' })
          }, 50)
          return
        }

        let pairInfo = null
        let pairContext = null
        try {
          pairInfo = await apiStore.getPairInfo()
          pairContext = apiStore.getPairContext ? apiStore.getPairContext() : null
        } catch (err) {
          pairInfo = null
          pairContext = null
        }

        const isPaired = !!(pairInfo && pairInfo.isPaired)
        const skippedPairing = !!(pairContext && pairContext.skipPairing)

        if (isPaired || skippedPairing) {
          setTimeout(() => {
            wx.switchTab({ url: '/pages/Home/index' })
          }, 50)
          return
        }

        if (this.globalData.shouldForcePairGuide || !isPaired) {
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/Pair/Pair' })
          }, 50)
        }
      })
      .catch(() => {})
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
    const categoryMap = loadCategoryMap()
    this.globalData = {
      // 默认走 Node API；网络不可用时 apiStore 会回退到本地 mockStore。
      // 可通过 wx.setStorageSync('apiBaseUrl', 'http://127.0.0.1:3100/api') 自定义接口地址。
      currentUserRole: 'me',
      partnerUserRole: 'ta',
      menuCategoryMap: categoryMap,
      orderStatusMap: {
        pending: '待确认',
        confirmed: '已确认',
        completed: '已完成',
        cancelled: '已取消'
      },
      PAGE_SIZE_MENU: 20,
      PAGE_SIZE_ORDER: 15,
      lastAuthExpiredNotifyTs: 0,
      shouldForcePairGuide: false
    }

    try {
      const entered = !!wx.getStorageSync('has_entered_once_v1')
      if (!entered) {
        wx.setStorageSync('has_entered_once_v1', true)
        this.globalData.shouldForcePairGuide = true
      }
    } catch (err) {
      this.globalData.shouldForcePairGuide = false
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
