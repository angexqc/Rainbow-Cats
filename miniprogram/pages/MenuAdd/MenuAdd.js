const apiStore = require('../../utils/apiStore')

Page({
  data: {
    title: '',
    image: '',
    desc: '',
    categories: ['主食', '饮品', '甜点', '其他'],
    categoryValues: ['main', 'drink', 'dessert', 'other'],
    categoryIndex: 0,
    available: true
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

  chooseImage() {
    const random = `https://picsum.photos/seed/menu_add_${Date.now()}/600/600`
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
      await apiStore.addMenu({
        title,
        image: this.data.image,
        desc: this.data.desc,
        category: this.data.categoryValues[this.data.categoryIndex],
        available: this.data.available
      })

      wx.showToast({ title: '添加成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err) {
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  }
})
