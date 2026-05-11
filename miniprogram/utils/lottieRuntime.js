let runtimeCache = null
let catRunningDataCache = null
let splashLoadingDataCache = null

function unwrapModule(mod) {
  if (!mod) return null
  return mod.default || mod
}

function resolveLottieRuntime() {
  if (runtimeCache) return runtimeCache
  const loaders = [
    () => require('../miniprogram_npm/lottie-miniprogram/index.js'),
    () => require('../miniprogram_npm/lottie-miniprogram/index'),
    () => require('lottie-miniprogram')
  ]
  for (let i = 0; i < loaders.length; i += 1) {
    try {
      const mod = unwrapModule(loaders[i]())
      if (mod && typeof mod.setup === 'function' && typeof mod.loadAnimation === 'function') {
        runtimeCache = mod
        return runtimeCache
      }
    } catch (err) {}
  }
  return null
}

function resolveCatRunningData() {
  if (catRunningDataCache) return catRunningDataCache
  const loaders = [
    () => require('../assets/lottie/cat-loading.data.js'),
    () => require('../assets/lottie/cat-loading.data'),
    () => require('../assets/lottie/cat-loading.json'),
    () => require('../assets/lottie/cat-loading')
  ]
  for (let i = 0; i < loaders.length; i += 1) {
    try {
      const data = unwrapModule(loaders[i]())
      if (data && data.v && data.w && data.h) {
        catRunningDataCache = data
        return catRunningDataCache
      }
    } catch (err) {
      console.warn('[lottieRuntime] resolveCatRunningData loader failed:', i, err && err.message)
    }
  }
  return null
}

function resolveSplashLoadingData() {
  if (splashLoadingDataCache) return splashLoadingDataCache
  const loaders = [
    () => require('../assets/lottie/splash-loading.data.js'),
    () => require('../assets/lottie/splash-loading.data'),
    () => require('../assets/lottie/splash-loading.json'),
    () => require('../assets/lottie/splash-loading')
  ]
  for (let i = 0; i < loaders.length; i += 1) {
    try {
      const data = unwrapModule(loaders[i]())
      if (data && data.v && data.w && data.h) {
        splashLoadingDataCache = data
        return splashLoadingDataCache
      }
    } catch (err) {
      console.warn('[lottieRuntime] resolveSplashLoadingData loader failed:', i, err && err.message)
    }
  }
  return null
}

module.exports = {
  resolveLottieRuntime,
  resolveCatRunningData,
  resolveSplashLoadingData
}
