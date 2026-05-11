Page({
  data: {
    exiting: false
  },

  onLoad() {
    this.unloaded = false
    this.routeDone = false
    this.minDurationDone = false
    this.prepareTimer = setTimeout(() => {
      this.minDurationDone = true
      this.tryRoute()
    }, 900)
    this.startBootstrapFlow()
  },

  onUnload() {
    this.unloaded = true
    this.routeDone = true
    if (this.prepareTimer) {
      clearTimeout(this.prepareTimer)
      this.prepareTimer = null
    }
    if (this.routeTimer) {
      clearTimeout(this.routeTimer)
      this.routeTimer = null
    }
  },

  safeSetData(next) {
    if (this.unloaded) return
    this.setData(next)
  },

  isCurrentSplashPage() {
    if (this.unloaded) return false
    const pages = getCurrentPages()
    if (!pages || !pages.length) return false
    const top = pages[pages.length - 1]
    return !!(top && top.route === 'pages/Splash/index')
  },

  async startBootstrapFlow() {
    const app = getApp()
    try {
      const launchState = await app.prepareLaunchState()
      this.launchState = launchState || { profileReady: false }
    } catch (err) {
      this.launchState = { profileReady: false }
    } finally {
      if (this.unloaded) return
      this.bootstrapDone = true
      this.tryRoute()
    }
  },

  tryRoute() {
    if (this.routeDone) return
    if (!this.isCurrentSplashPage()) return
    if (!this.bootstrapDone || !this.minDurationDone) return
    this.routeDone = true

    const profileReady = !!(this.launchState && this.launchState.profileReady)
    this.safeSetData({ exiting: true })
    this.routeTimer = setTimeout(() => {
      if (!this.isCurrentSplashPage()) return
      const onRouteFail = () => {
        if (this.unloaded) return
        this.routeDone = false
        this.safeSetData({ exiting: false })
        this.routeTimer = setTimeout(() => {
          if (this.unloaded) return
          this.tryRoute()
        }, 240)
      }

      if (profileReady) {
        wx.switchTab({
          url: '/pages/Home/index',
          fail: onRouteFail
        })
        return
      }
      wx.reLaunch({
        url: '/pages/ProfileSetup/index',
        fail: onRouteFail
      })
    }, 180)
  }
})
