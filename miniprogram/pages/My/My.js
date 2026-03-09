const apiStore = require('../../utils/apiStore')
const { uploadImage } = require('../../services/upload')
const { getTopSafeHeight } = require('../../utils/safeArea')

const DEFAULT_CATEGORY_MAP = {
  main: '主食',
  drink: '饮品',
  dessert: '甜点',
  other: '其他'
}
const CATEGORY_ORDER_KEY = 'menuCategoryOrder'
const CATEGORY_ITEM_HEIGHT = 52

Page({
  data: {
    topSafeHeight: 0,
    banners: [],
    bannerCurrent: 0,
    categoryEntries: [],
    isPaired: false,
    draggingCategoryIndex: -1,
    dragPreviewIndex: -1
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

  saveCategoryMapByEntries(entries = []) {
    const app = getApp()
    const source = Array.isArray(entries) ? entries : []
    const nextMap = {}
    const nextOrder = []
    source.forEach((item) => {
      const key = String((item && item.key) || '').trim()
      if (!key) return
      nextMap[key] = String((item && item.label) || key)
      nextOrder.push(key)
    })
    if (app.globalData) {
      app.globalData.menuCategoryMap = nextMap
    }
    wx.setStorageSync('menuCategoryMap', nextMap)
    wx.setStorageSync(CATEGORY_ORDER_KEY, nextOrder)
    this.setData({ categoryEntries: source })
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
      success: async (res) => {
        if (!res.confirm) return
        const normalized = String(res.content || '').trim().slice(0, 16)
        if (!normalized) {
          wx.showToast({ title: '分类名不能为空', icon: 'none' })
          return
        }
        const key = this.makeReadableCategoryKey(normalized)
        await this.updateCategoryLabel(key, normalized)
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
      success: async (res) => {
        if (!res.confirm) return
        const label = String(res.content || '').trim().slice(0, 16)
        if (!label) {
          wx.showToast({ title: '分类名不能为空', icon: 'none' })
          return
        }
        await this.updateCategoryLabel(key, label)
      }
    })
  },

  makeReadableCategoryKey(label) {
    const entries = this.getCategoryEntries()
    const base = String(label || '').trim().slice(0, 16)
    if (!base) return ''
    if (!entries.some((it) => it.key === base)) return base
    let seq = 2
    let candidate = `${base}_${seq}`
    while (entries.some((it) => it.key === candidate)) {
      seq += 1
      candidate = `${base}_${seq}`
    }
    return candidate
  },

  async migrateCategoryKey(fromKey, toKey) {
    const from = String(fromKey || '').trim()
    const to = String(toKey || '').trim()
    if (!from || !to || from === to) return

    const identity = apiStore.getWxIdentity() || {}
    const selfId = String(identity.userId || '')
    if (!selfId) return

    let page = 1
    const pageSize = 100
    const targetMenus = []
    while (true) {
      const res = await apiStore.getMenuList({ page, pageSize })
      const list = Array.isArray(res.list) ? res.list : []
      targetMenus.push(
        ...list.filter((m) => String((m && m.owner) || '') === selfId && String((m && m.category) || '') === from)
      )
      if (!res.hasMore) break
      page += 1
    }

    for (const menu of targetMenus) {
      await apiStore.updateMenu(menu._id, {
        title: menu.title,
        image: menu.image,
        desc: menu.desc || '',
        category: to,
        available: !!menu.available
      })
    }
  },

  async updateCategoryLabel(key, label) {
    const current = this.getCategoryEntries()
    const index = current.findIndex((item) => item.key === key)
    const next = [...current]
    let changedKeyFrom = ''
    let changedKeyTo = ''
    if (index >= 0) {
      const prev = next[index]
      const nextKey = String(label || '').trim().slice(0, 16)
      if (!nextKey) return
      if (prev.key !== nextKey) {
        if (next.some((it, i) => i !== index && it.key === nextKey)) {
          wx.showToast({ title: '分类名称已存在', icon: 'none' })
          return
        }
        changedKeyFrom = prev.key
        changedKeyTo = nextKey
        next[index] = { key: nextKey, label }
      } else {
        next[index] = { ...next[index], label }
      }
    } else {
      next.push({ key, label })
    }
    this.saveCategoryMapByEntries(next)
    if (changedKeyFrom && changedKeyTo) {
      wx.showLoading({ title: '同步分类中...', mask: true })
      try {
        await this.migrateCategoryKey(changedKeyFrom, changedKeyTo)
      } catch (err) {
        wx.showToast({ title: '分类名已改，但菜单同步失败', icon: 'none' })
      } finally {
        wx.hideLoading()
      }
    }
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  resetCategories() {
    const entries = Object.keys(DEFAULT_CATEGORY_MAP).map((key) => ({
      key,
      label: DEFAULT_CATEGORY_MAP[key]
    }))
    this.saveCategoryMapByEntries(entries)
    wx.showToast({ title: '已恢复默认', icon: 'success' })
  },

  onCategoryDragStart(e) {
    const idx = Number(e.currentTarget.dataset.index)
    const touch = e.touches && e.touches[0]
    if (!Number.isInteger(idx) || idx < 0 || !touch) return
    this.dragStartIndex = idx
    this.dragStartY = Number(touch.clientY || 0)
    this.dragCurrentY = this.dragStartY
    this.setData({ draggingCategoryIndex: idx, dragPreviewIndex: idx })
  },

  onCategoryDragMove(e) {
    const touch = e.touches && e.touches[0]
    if (!touch) return
    this.dragCurrentY = Number(touch.clientY || 0)
    const startIndex = Number(this.dragStartIndex)
    if (!Number.isInteger(startIndex) || startIndex < 0) return
    const entries = this.data.categoryEntries || []
    const rawStep = Math.round((this.dragCurrentY - Number(this.dragStartY || 0)) / 36)
    const targetIndex = Math.max(0, Math.min(entries.length - 1, startIndex + rawStep))
    this.setData({ dragPreviewIndex: targetIndex })
  },

  onCategoryDragEnd() {
    const startIndex = Number(this.dragStartIndex)
    const startY = Number(this.dragStartY || 0)
    const endY = Number(this.dragCurrentY || startY)
    this.dragStartIndex = -1
    this.dragStartY = 0
    this.dragCurrentY = 0
    const previewIndex = Number(this.data.dragPreviewIndex)
    this.setData({ draggingCategoryIndex: -1, dragPreviewIndex: -1 })

    if (!Number.isInteger(startIndex) || startIndex < 0) return
    const entries = [...this.data.categoryEntries]
    if (entries.length < 2) return

    let targetIndex = previewIndex
    if (!Number.isInteger(targetIndex) || targetIndex < 0) {
      const rawStep = Math.round((endY - startY) / CATEGORY_ITEM_HEIGHT)
      if (!rawStep) return
      targetIndex = Math.max(0, Math.min(entries.length - 1, startIndex + rawStep))
    }
    if (targetIndex === startIndex) return

    const [moved] = entries.splice(startIndex, 1)
    entries.splice(targetIndex, 0, moved)
    this.saveCategoryMapByEntries(entries)
    wx.showToast({ title: '分类顺序已更新', icon: 'none' })
  },

  goPairing() {
    wx.reLaunch({ url: '/pages/Pair/Pair' })
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
