const {
  resolveLottieRuntime,
  resolveCatRunningData,
  resolveSplashLoadingData
} = require('../../utils/lottieRuntime')

Component({
  properties: {
    size: {
      type: Number,
      value: 52
    },
    animationType: {
      type: String,
      value: 'cat',
      observer() {
        this.reinitAnimation()
      }
    }
  },

  data: {
    fallback: false
  },

  lifetimes: {
    ready() {
      this.componentReady = true
      this.unloaded = false
      this.scheduleInit(0)
    },

    detached() {
      this.componentReady = false
      this.unloaded = true
      if (this.initTimer) {
        clearTimeout(this.initTimer)
        this.initTimer = null
      }
      this.destroyAnimation()
    }
  },

  methods: {
    resolveAnimationData() {
      if (this.data.animationType === 'splash') {
        return resolveSplashLoadingData()
      }
      return resolveCatRunningData()
    },

    reinitAnimation() {
      if (!this.componentReady) return
      if (this.unloaded) return
      this.destroyAnimation()
      if (this.data.fallback) this.setData({ fallback: false })
      this.scheduleInit(0)
    },

    scheduleInit(delay = 0, attempt = 0) {
      if (this.unloaded) return
      if (this.initTimer) {
        clearTimeout(this.initTimer)
      }
      this.initTimer = setTimeout(() => {
        this.initTimer = null
        this.initAnimation(attempt)
      }, Math.max(Number(delay) || 0, 0))
    },

    initAnimation(attempt = 0) {
      if (this.unloaded || this.anim) return
      const runtime = resolveLottieRuntime()
      const animData = this.resolveAnimationData()
      if (!runtime || !animData) {
        if (attempt < 10) {
          this.scheduleInit(80 + attempt * 40, attempt + 1)
          return
        }
        console.error('[CatLottieLoader] runtime or data unavailable', {
          runtimeReady: !!runtime,
          animationReady: !!animData,
          animationType: this.data.animationType,
          attempt
        })
        this.setData({ fallback: true })
        return
      }

      wx.createSelectorQuery()
        .in(this)
        .select('#catLottieCanvas')
        .fields({ node: true, size: true }, (res) => {
          if (this.unloaded || this.anim) return
          if (!res || !res.node) {
            if (attempt < 10) {
              this.scheduleInit(90 + attempt * 50, attempt + 1)
              return
            }
            console.error('[CatLottieLoader] canvas node unavailable', { attempt, res: !!res })
            this.setData({ fallback: true })
            return
          }

          try {
            const canvas = res.node
            const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || wx.getSystemInfoSync().pixelRatio || 1
            const logicalWidth = Math.max(Number(animData.w) || 220, 160)
            const logicalHeight = Math.max(Number(animData.h) || 220, 160)

            canvas.width = logicalWidth * dpr
            canvas.height = logicalHeight * dpr

            const context = canvas.getContext('2d')
            if (context.setTransform) context.setTransform(1, 0, 0, 1, 0, 0)
            context.clearRect(0, 0, canvas.width, canvas.height)
            context.scale(dpr, dpr)

            runtime.setup(canvas)
            this.anim = runtime.loadAnimation({
              loop: true,
              autoplay: true,
              animationData: animData,
              rendererSettings: { context }
            })
            if (!this.anim) throw new Error('loadAnimation returned empty instance')
            if (this.data.fallback) this.setData({ fallback: false })
          } catch (err) {
            if (attempt < 8) {
              this.scheduleInit(120 + attempt * 60, attempt + 1)
              return
            }
            console.error('[CatLottieLoader] loadAnimation failed', err)
            this.setData({ fallback: true })
          }
        })
        .exec()
    },

    destroyAnimation() {
      if (this.anim && this.anim.destroy) {
        this.anim.destroy()
      }
      this.anim = null
    }
  }
})
