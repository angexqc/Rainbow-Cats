const apiStore = require('../../utils/apiStore')
const { uploadImage } = require('../../services/upload')
const { getTopSafeHeight } = require('../../utils/safeArea')

Page({
  data: {
    topSafeHeight: 0,
    menuId: '',
    title: '',
    image: '',
    desc: '',
    categories: [],
    categoryValues: [],
    categoryIndex: 0,
    available: true,
    menu: true
  },

  onLoad(options) {
    this.setData({ topSafeHeight: getTopSafeHeight() })
    const { id } = options
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
      return
    }

    this.setData({ menuId: id })
    this.loadMenuDetail(id)
  },

  async refreshCategories(preferredKey = '') {
    try {
      const list = await apiStore.getMenuCategories()
      const source = Array.isArray(list) ? list : []
      const categoryValues = source.map((it) => String((it && it.key) || '').trim()).filter(Boolean)
      const categories = source.map((it) => String((it && it.label) || '').trim() || String((it && it.key) || ''))
      let categoryIndex = Math.min(this.data.categoryIndex, Math.max(0, categoryValues.length - 1))
      if (preferredKey && categoryValues.includes(preferredKey)) {
        categoryIndex = Math.max(0, categoryValues.indexOf(preferredKey))
      }
      this.setData({ categories, categoryValues, categoryIndex })
    } catch (err) {
      this.setData({
        categories: ['其他'],
        categoryValues: ['other'],
        categoryIndex: 0
      })
    }
  },

  async loadMenuDetail(id) {
    try {
      const menu = await apiStore.getMenuById(id)
      if (!menu) {
        wx.showToast({ title: '菜品不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 500)
        return
      }

      await this.refreshCategories(menu.category)
      let rawIndex = this.data.categoryValues.indexOf(menu.category)
      if (rawIndex < 0) {
        const fallbackCategory = String(menu.category || 'other')
        const fallbackLabel = String(menu.categoryLabel || fallbackCategory)
        await apiStore.upsertMenuCategory({ key: fallbackCategory, label: fallbackLabel })
        await this.refreshCategories(fallbackCategory)
        rawIndex = this.data.categoryValues.indexOf(fallbackCategory)
      }
      const categoryIndex = Math.max(0, rawIndex)
      this.setData({
        title: menu.title,
        image: menu.image,
        desc: menu.desc || '',
        categoryIndex,
        available: !!menu.available,
        menu: true
      })
    } catch (err) {
      wx.showToast({ title: '加载菜品失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
    }
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ desc: e.detail.value })
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) })
  },

  onToggleAvailable(e) {
    this.setData({ available: !!e.detail.value })
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempPath = res.tempFilePaths && res.tempFilePaths[0]
        if (!tempPath) return
        wx.showLoading({ title: '上传中...', mask: true })
        try {
          const url = await uploadImage(tempPath, 'menus')
          this.setData({ image: url })
          wx.showToast({ title: '上传成功', icon: 'success' })
        } catch (err) {
          const msg = String((err && err.message) || '上传失败')
          wx.showToast({ title: msg.slice(0, 16), icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      },
      fail: (err) => {
        if (err && /cancel/i.test(String(err.errMsg || ''))) {
          wx.showToast({ title: '已取消选择', icon: 'none' })
          return
        }
        wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
    })
  },

  handleCancel() {
    wx.navigateBack()
  },

  async handleSave() {
    const title = (this.data.title || '').trim()

    if (!title) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }
    if (!this.data.image) {
      wx.showToast({ title: '请上传菜品图片', icon: 'none' })
      return
    }

    const category = this.data.categoryValues[this.data.categoryIndex] || 'other'
    const categoryLabel = this.data.categories[this.data.categoryIndex] || category
    try {
      await apiStore.updateMenu(this.data.menuId, {
        title,
        image: this.data.image,
        desc: this.data.desc,
        category,
        categoryLabel,
        available: this.data.available
      })

      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
