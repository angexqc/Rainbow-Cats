function getTopSafeHeight(extra = 8) {
  try {
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
    if (menu && menu.bottom) {
      return Math.max(0, Number(menu.bottom) + Number(extra || 0))
    }
    const status = Number(sys.statusBarHeight || 20)
    return status + 40
  } catch (err) {
    return 52
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
      safeBottomInset,
      tabBarHeight: inferredTabBarHeight > 20 ? inferredTabBarHeight : fallbackTabBarHeight
    }
  } catch (err) {
    return {
      windowHeight: 0,
      screenHeight: 0,
      safeBottomInset: 0,
      tabBarHeight: 56
    }
  }
}

function computeNavbarTabPageContentHeight(topSafeHeight, headerBodyHeight = 56) {
  const metrics = getViewportMetrics()
  const headerHeight = Math.max(0, Number(topSafeHeight || 0)) + Math.max(0, Number(headerBodyHeight || 0))
  const baseHeight = metrics.screenHeight > 0 ? metrics.screenHeight : metrics.windowHeight
  const nextHeight = baseHeight - headerHeight - Math.max(0, Number(metrics.tabBarHeight || 0))
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

module.exports = {
  getTopSafeHeight,
  getViewportMetrics,
  computeNavbarTabPageContentHeight,
  computeTopSafeTabPageContentHeight
}
