const apiStore = require('../../utils/apiStore')
const { uploadImage } = require('../../services/upload')
const { getTopSafeHeight } = require('../../utils/safeArea')

const DEFAULT_CATEGORY_MAP = {
  main: '主食',
  drink: '饮品',
  dessert: '甜点',
  other: '其他'
}

Page({
  data: {
    topSafeHeight: 0,
    banners: [],
    bannerCurrent: 0,
    categoryEntries: [],
    isPaired: false
  },

  onLoad() {
    this.setData({ topSafeHeight: getTopSafeHeight() })
    this.loadPageData()
  },

  onShow() {
    this.loadPageData()
  },

  async loadPageData() {
    try {
      const [banners, pair] = await Promise.all([
        apiStore.getHomeBanners(),
        apiStore.getPairInfo()
      ])
      const normalizedBanners = this.normalizeBanners(banners)
      this.setData({
        banners: normalizedBanners,
        bannerCurrent: 0,
        categoryEntries: this.getCategoryEntries(),
        isPaired: !!(pair && pair.isPaired)
      })
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onBannerChange(e) {
    const current = (e.detail && Number(e.detail.current)) || 0
    this.setData({ bannerCurrent: current })
  },

  normalizeBanners(list = []) {
    return (Array.isArray(list) ? list : [])
      .map((item, idx) => {
        if (typeof item === 'string') {
          return { id: `banner_${idx}_${item.slice(-12)}`, url: item }
        }
        if (item && typeof item === 'object' && item.url) {
          return { id: String(item.id || `banner_${idx}`), url: String(item.url) }
        }
        return null
      })
      .filter((item) => item && item.url)
  },

  getCategoryEntries() {
    const app = getApp()
    const map = (app.globalData && app.globalData.menuCategoryMap) || DEFAULT_CATEGORY_MAP
    return Object.keys(map).map((key) => ({
      key,
      label: map[key] || key
    }))
  },

  async handleUploadBanner() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.tempFilePath) return

        wx.showLoading({ title: '上传中...', mask: true })
        try {
          const url = await uploadImage(file.tempFilePath, 'banners')
          await apiStore.addHomeBanner(url)
          await this.loadPageData()
          wx.showToast({ title: '上传成功', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: '上传失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  previewBanner(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({
      current: url,
      urls: (this.data.banners || []).map((item) => item.url).filter(Boolean)
    })
  },

  deleteBanner(e) {
    const url = e.currentTarget.dataset.url
    const idx = Number(e.currentTarget.dataset.idx)
    const targetUrl = url || ((this.data.banners[idx] && this.data.banners[idx].url) || '')
    if (!targetUrl) return
    wx.showModal({
      title: '删除轮播图',
      content: '确认删除这张轮播图吗？',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中...', mask: true })
        try {
          await apiStore.deleteHomeBanner(targetUrl)
          await this.loadPageData()
          wx.showToast({ title: '删除成功', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  addCategory() {
    wx.showModal({
      title: '新增分类',
      editable: true,
      placeholderText: '输入分类名称，例如：小吃',
      success: (res) => {
        if (!res.confirm) return
        const label = String(res.content || '').trim().slice(0, 8)
        if (!label) {
          wx.showToast({ title: '分类名不能为空', icon: 'none' })
          return
        }
        const key = `custom_${Date.now().toString(36).slice(-6)}`
        this.updateCategoryLabel(key, label)
      }
    })
  },

  editCategory(e) {
    const key = e.currentTarget.dataset.key
    const current = this.data.categoryEntries.find((it) => it.key === key)
    if (!current) return

    wx.showModal({
      title: '编辑分类',
      editable: true,
      placeholderText: '输入分类名称',
      content: current.label,
      success: (res) => {
        if (!res.confirm) return
        const label = String(res.content || '').trim().slice(0, 8)
        if (!label) {
          wx.showToast({ title: '分类名不能为空', icon: 'none' })
          return
        }
        this.updateCategoryLabel(key, label)
      }
    })
  },

  updateCategoryLabel(key, label) {
    const app = getApp()
    const prev = (app.globalData && app.globalData.menuCategoryMap) || DEFAULT_CATEGORY_MAP
    const nextMap = { ...prev, [key]: label }
    if (app.globalData) {
      app.globalData.menuCategoryMap = nextMap
    }
    wx.setStorageSync('menuCategoryMap', nextMap)
    this.setData({ categoryEntries: this.getCategoryEntries() })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  resetCategories() {
    const app = getApp()
    if (app.globalData) {
      app.globalData.menuCategoryMap = { ...DEFAULT_CATEGORY_MAP }
    }
    wx.setStorageSync('menuCategoryMap', { ...DEFAULT_CATEGORY_MAP })
    this.setData({ categoryEntries: this.getCategoryEntries() })
    wx.showToast({ title: '已恢复默认', icon: 'success' })
  },

  goPairing() {
    wx.reLaunch({ url: '/pages/Pair/Pair' })
  },

  goNotifySettings() {
    wx.navigateTo({ url: '/pages/NotifySettings/index' })
  },

  goProfileSetup() {
    wx.navigateTo({ url: '/pages/ProfileSetup/index?from=my' })
  },

  unbindPair() {
    wx.showModal({
      title: '解除关联',
      content: '确认解除当前情侣关联吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await apiStore.unbindPair()
          await this.loadPageData()
          wx.showToast({ title: '已解除关联', icon: 'success' })
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/Pair/Pair' })
          }, 500)
        } catch (err) {
          wx.showToast({ title: '解除失败', icon: 'none' })
        }
      }
    })
  }
})
