let lottie = null
let splashAnimData = null

function unwrapModule(mod) {
  if (!mod) return null
  return mod.default || mod
}

function resolveLottieRuntime() {
  if (lottie) return lottie
  const loaders = [
    () => require('../../miniprogram_npm/lottie-miniprogram/index.js'),
    () => require('../../miniprogram_npm/lottie-miniprogram/index'),
    () => require('lottie-miniprogram')
  ]
  for (let i = 0; i < loaders.length; i += 1) {
    try {
      const mod = unwrapModule(loaders[i]())
      if (mod && typeof mod.setup === 'function' && typeof mod.loadAnimation === 'function') {
        lottie = mod
        return lottie
      }
    } catch (err) {}
  }
  return null
}

function resolveSplashAnimationData() {
  if (splashAnimData) return splashAnimData
  const loaders = [
    () => require('../../assets/lottie/splash-loading.data.js'),
    () => require('../../assets/lottie/splash-loading.data'),
    () => require('../../assets/lottie/splash-loading.json'),
    () => require('../../assets/lottie/splash-loading')
  ]
  for (let i = 0; i < loaders.length; i += 1) {
    try {
      const data = unwrapModule(loaders[i]())
      if (data && data.v && data.w && data.h) {
        splashAnimData = data
        return splashAnimData
      }
    } catch (err) {}
  }
  return null
}

Page({
  data: {
    loadingText: '正在准备你的专属菜单...',
    lottieFallback: false,
    lottieErrorText: '',
    lottieDisplaySize: 220,
    exiting: false
  },

  onLoad() {
    this.routeDone = false
    this.minDurationDone = false
    this.prepareTimer = setTimeout(() => {
      this.minDurationDone = true
      this.tryRoute()
    }, 900)
    this.startBootstrapFlow()
  },

  onReady() {
    this.initLottie()
  },

  onUnload() {
    if (this.prepareTimer) {
      clearTimeout(this.prepareTimer)
      this.prepareTimer = null
    }
    if (this.routeTimer) {
      clearTimeout(this.routeTimer)
      this.routeTimer = null
    }
    if (this.lottieAnim && this.lottieAnim.destroy) {
      this.lottieAnim.destroy()
      this.lottieAnim = null
    }
  },

  initLottie() {
    const runtime = resolveLottieRuntime()
    const animData = resolveSplashAnimationData()
    if (!runtime || !animData) {
      const reason = !runtime ? 'lottie 模块加载失败' : '动画 JSON 加载失败'
      console.error('[Splash] Lottie not ready:', {
        runtimeReady: !!runtime,
        animationReady: !!animData
      })
      this.setData({ lottieFallback: true, lottieErrorText: reason })
      return
    }
    console.info('[Splash] Lottie ready:', { version: animData.v, size: `${animData.w}x${animData.h}` })

    wx.createSelectorQuery()
      .in(this)
      .select('#splashLottie')
      .fields({ node: true, size: true }, (res) => {
        if (!res || !res.node) {
          this.setData({ lottieFallback: true, lottieErrorText: '未找到 canvas 节点' })
          return
        }
        try {
          const canvas = res.node
          const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : null
          const dpr = (windowInfo && windowInfo.pixelRatio) || wx.getSystemInfoSync().pixelRatio || 1
          const animWidth = Math.max(Number(animData.w) || 220, 160)
          const animHeight = Math.max(Number(animData.h) || 220, 160)
          const displaySize = Math.max(Math.floor(res.width || 220), 180)
          this.setData({ lottieDisplaySize: displaySize })
          const logicalWidth = animWidth
          const logicalHeight = animHeight
          canvas.width = logicalWidth * dpr
          canvas.height = logicalHeight * dpr
          const context = canvas.getContext('2d')
          if (context.setTransform) {
            context.setTransform(1, 0, 0, 1, 0, 0)
          }
          context.clearRect(0, 0, canvas.width, canvas.height)
          context.scale(dpr, dpr)
          runtime.setup(canvas)
          this.lottieAnim = runtime.loadAnimation({
            loop: true,
            autoplay: true,
            animationData: animData,
            rendererSettings: {
              context
            }
          })
          if (this.lottieAnim && this.lottieAnim.addEventListener) {
            this.lottieAnim.addEventListener('data_failed', () => {
              this.setData({ lottieFallback: true, lottieErrorText: '动画数据加载失败' })
            })
          }
        } catch (err) {
          this.setData({ lottieFallback: true, lottieErrorText: '动画渲染失败' })
          console.error('[Splash] lottie init failed:', err)
        }
      })
      .exec()
  },

  async startBootstrapFlow() {
    this.setData({ loadingText: '正在验证登录状态...' })
    const app = getApp()
    try {
      const launchState = await app.prepareLaunchState()
      this.launchState = launchState || { profileReady: false }
      this.setData({ loadingText: this.launchState.profileReady ? '欢迎回来，马上进入首页...' : '首次使用，准备完善资料...' })
    } catch (err) {
      this.launchState = { profileReady: false }
      this.setData({ loadingText: '初始化失败，先进入资料配置...' })
    } finally {
      this.bootstrapDone = true
      this.tryRoute()
    }
  },

  tryRoute() {
    if (this.routeDone) return
    if (!this.bootstrapDone || !this.minDurationDone) return
    this.routeDone = true

    const profileReady = !!(this.launchState && this.launchState.profileReady)
    this.setData({ exiting: true })
    this.routeTimer = setTimeout(() => {
      if (this.lottieAnim && this.lottieAnim.destroy) {
        this.lottieAnim.destroy()
        this.lottieAnim = null
      }
      if (profileReady) {
        wx.switchTab({ url: '/pages/Home/index' })
        return
      }
      wx.reLaunch({ url: '/pages/ProfileSetup/index' })
    }, 180)
  }
})
