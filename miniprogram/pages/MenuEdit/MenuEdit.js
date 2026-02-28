const apiStore = require('../../utils/apiStore')

Page({
  data: {
    menuId: '',
    title: '',
    image: '',
    desc: '',
    categories: ['主食', '饮品', '甜点', '其他'],
    categoryValues: ['main', 'drink', 'dessert', 'other'],
    categoryIndex: 0,
    available: true,
    menu: true
  },

  onLoad(options) {
    const { id } = options
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
      return
    }

    this.setData({ menuId: id })
    this.loadMenuDetail(id)
  },

  async loadMenuDetail(id) {
    try {
      const menu = await apiStore.getMenuById(id)
      if (!menu) {
        wx.showToast({ title: '菜品不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 500)
        return
      }

      const categoryIndex = Math.max(0, this.data.categoryValues.indexOf(menu.category))
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
    const random = `https://picsum.photos/seed/menu_edit_${Date.now()}/600/600`
    this.setData({ image: random })
    wx.showToast({ title: '已使用示例图片', icon: 'none' })
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

    try {
      await apiStore.updateMenu(this.data.menuId, {
        title,
        image: this.data.image,
        desc: this.data.desc,
        category: this.data.categoryValues[this.data.categoryIndex],
        available: this.data.available
      })

      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
