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

module.exports = { getTopSafeHeight }
