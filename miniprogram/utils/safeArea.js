function getTopSafeHeight() {
  try {
    const windowInfo = wx.getWindowInfo ? (wx.getWindowInfo() || {}) : {}
    const legacy = !wx.getWindowInfo && wx.getSystemInfoSync ? (wx.getSystemInfoSync() || {}) : {}
    const capsule = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const statusBarHeight = Math.max(0, Number(windowInfo.statusBarHeight || legacy.statusBarHeight || 20))
    const capsuleBottom = Number(capsule && (capsule.bottom || (Number(capsule.top || 0) + Number(capsule.height || 0))))
    if (capsuleBottom > 0) return Math.max(capsuleBottom - 18, statusBarHeight, 52)
    return Math.max(statusBarHeight + 8, 52)
  } catch (err) {
    return 52
  }
}

function getContentTopSafeHeight() {
  try {
    const windowInfo = wx.getWindowInfo ? (wx.getWindowInfo() || {}) : {}
    const legacy = !wx.getWindowInfo && wx.getSystemInfoSync ? (wx.getSystemInfoSync() || {}) : {}
    const capsule = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const statusBarHeight = Math.max(0, Number(windowInfo.statusBarHeight || legacy.statusBarHeight || 20))
    const capsuleBottom = Number(capsule && (capsule.bottom || (Number(capsule.top || 0) + Number(capsule.height || 0))))
    if (capsuleBottom > 0) return Math.max(capsuleBottom + 6, statusBarHeight + 44, 92)
    return Math.max(statusBarHeight + 44, 92)
  } catch (err) {
    return 92
  }
}

function getCapsuleMetrics() {
  try {
    const windowInfo = wx.getWindowInfo ? (wx.getWindowInfo() || {}) : {}
    const legacy = !wx.getWindowInfo && wx.getSystemInfoSync ? (wx.getSystemInfoSync() || {}) : {}
    const capsule = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const screenWidth = Number(windowInfo.windowWidth || windowInfo.screenWidth || legacy.windowWidth || legacy.screenWidth || 375)
    if (!capsule || !capsule.left) {
      return { left: screenWidth - 96, right: 8, top: 8, bottom: 40, width: 88, height: 32, safeRight: 104 }
    }
    const left = Number(capsule.left)
    const right = Math.max(0, screenWidth - Number(capsule.right || screenWidth))
    const top = Math.max(0, Number(capsule.top || 0))
    const width = Math.max(0, Number(capsule.width || capsule.right - capsule.left || 0))
    const height = Math.max(0, Number(capsule.height || capsule.bottom - capsule.top || 0))
    return { left, right, top, bottom: top + height, width, height, safeRight: screenWidth - left + 8 }
  } catch (err) {
    return { left: 279, right: 8, top: 8, bottom: 40, width: 88, height: 32, safeRight: 104 }
  }
}

function getViewportMetrics() {
  try {
    const raw = wx.getWindowInfo ? (wx.getWindowInfo() || {}) : (wx.getSystemInfoSync ? wx.getSystemInfoSync() : {})
    const screenHeight = Number(raw.screenHeight || 0)
    const windowHeight = Number(raw.windowHeight || 0)
    const statusBarHeight = Number(raw.statusBarHeight || 0)
    const safeArea = raw.safeArea || {}
    const safeBottomInset = Math.max(0, screenHeight - Number(safeArea.bottom || screenHeight || 0))
    const inferredTabBarHeight = Math.max(0, screenHeight - windowHeight - statusBarHeight)
    const fallbackTabBarHeight = 50 + safeBottomInset

    return {
      windowHeight,
      screenHeight,
      statusBarHeight,
      safeBottomInset,
      tabBarHeight: inferredTabBarHeight > 20 ? inferredTabBarHeight : fallbackTabBarHeight
    }
  } catch (err) {
    return {
      windowHeight: 0,
      screenHeight: 0,
      statusBarHeight: 20,
      safeBottomInset: 0,
      tabBarHeight: 56
    }
  }
}

function computeNavbarTabPageContentHeight(topSafeHeight, headerBodyHeight = 64) {
  const metrics = getViewportMetrics()
  const baseHeight = metrics.screenHeight > 0 ? metrics.screenHeight : metrics.windowHeight
  const nextHeight = baseHeight - Math.max(0, Number(topSafeHeight || metrics.statusBarHeight || 0)) - Math.max(0, Number(headerBodyHeight || 0)) - Math.max(0, Number(metrics.tabBarHeight || 0))
  return {
    ...metrics,
    contentHeight: nextHeight > 0 ? nextHeight : 0
  }
}

function computeTopSafeTabPageContentHeight() {
  const metrics = getViewportMetrics()
  const baseHeight = metrics.screenHeight > 0 ? metrics.screenHeight : metrics.windowHeight
  const nextHeight = baseHeight - Math.max(0, Number(metrics.tabBarHeight || 0))
  return {
    ...metrics,
    contentHeight: nextHeight > 0 ? nextHeight : 0
  }
}

function computeContentHeight({ topSafeHeight, headerBodyHeight = 64, bottomBarHeight = 0, includeTabBar = true } = {}) {
  const metrics = getViewportMetrics()
  const baseHeight = metrics.screenHeight > 0 ? metrics.screenHeight : metrics.windowHeight
  const topInset = Math.max(0, Number(topSafeHeight || metrics.statusBarHeight || 0))
  const tabBar = includeTabBar ? Math.max(0, Number(metrics.tabBarHeight || 0)) : 0
  const nextHeight = baseHeight - topInset - Math.max(0, Number(headerBodyHeight || 0)) - tabBar - Math.max(0, Number(bottomBarHeight || 0))
  return { ...metrics, contentHeight: nextHeight > 0 ? nextHeight : 0 }
}

module.exports = {
  getTopSafeHeight,
  getContentTopSafeHeight,
  getCapsuleMetrics,
  getViewportMetrics,
  computeNavbarTabPageContentHeight,
  computeTopSafeTabPageContentHeight,
  computeContentHeight
}
