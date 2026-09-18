const apiStore = require('../../utils/apiStore')
const { getTopSafeHeight } = require('../../utils/safeArea')

Page({
  data: {
    topSafeHeight: 0,
    loading: false,
    saving: false,
    spiceOptions: [
      { key: 'any', label: '都可以' }, { key: 'none', label: '不辣' },
      { key: 'mild', label: '微辣' }, { key: 'medium', label: '中辣' }, { key: 'hot', label: '重辣' }
    ],
    dietOptions: [
      { key: 'omnivore', label: '正常饮食' }, { key: 'vegetarian', label: '蛋奶素' },
      { key: 'vegan', label: '纯素' }, { key: 'low_sugar', label: '低糖' }, { key: 'fitness', label: '健身餐' }
    ],
    flavorOptions: [
      { value: '清淡', selected: false }, { value: '香辣', selected: false },
      { value: '酸甜', selected: false }, { value: '咸鲜', selected: false }, { value: '浓郁', selected: false }
    ],
    spiceLevel: 'any', dietType: 'omnivore', flavors: [],
    avoidText: '', allergyText: '', shareWithPartner: false
  },

  onLoad() {
    this.setData({ topSafeHeight: getTopSafeHeight() })
    this.loadPreferences()
  },

  async loadPreferences() {
    this.setData({ loading: true })
    try {
      const data = await apiStore.getFoodPreferences()
      const flavors = Array.isArray(data.flavors) ? data.flavors : []
      this.setData({
        spiceLevel: data.spiceLevel || 'any',
        dietType: data.dietType || 'omnivore',
        flavors,
        flavorOptions: this.data.flavorOptions.map((item) => ({ ...item, selected: flavors.includes(item.value) })),
        avoidText: (data.avoidIngredients || []).join('、'),
        allergyText: (data.allergyIngredients || []).join('、'),
        shareWithPartner: !!data.shareWithPartner
      })
    } catch (err) {
      wx.showToast({ title: '加载偏好失败', icon: 'none' })
    } finally { this.setData({ loading: false }) }
  },

  handleBack() { wx.navigateBack() },
  selectSpice(e) { this.setData({ spiceLevel: e.currentTarget.dataset.key }) },
  selectDiet(e) { this.setData({ dietType: e.currentTarget.dataset.key }) },
  toggleFlavor(e) {
    const value = e.currentTarget.dataset.value
    const current = this.data.flavors.slice()
    const index = current.indexOf(value)
    if (index >= 0) current.splice(index, 1)
    else current.push(value)
    this.setData({
      flavors: current,
      flavorOptions: this.data.flavorOptions.map((item) => ({ ...item, selected: current.includes(item.value) }))
    })
  },
  onAvoidInput(e) { this.setData({ avoidText: e.detail.value }) },
  onAllergyInput(e) { this.setData({ allergyText: e.detail.value }) },
  onShareChange(e) { this.setData({ shareWithPartner: !!e.detail.value }) },
  parseList(value) {
    return String(value || '').split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean)
  },

  async save() {
    this.setData({ saving: true })
    try {
      await apiStore.updateFoodPreferences({
        spiceLevel: this.data.spiceLevel,
        dietType: this.data.dietType,
        flavors: this.data.flavors,
        avoidIngredients: this.parseList(this.data.avoidText),
        allergyIngredients: this.parseList(this.data.allergyText),
        shareWithPartner: this.data.shareWithPartner
      })
      wx.showToast({ title: '偏好已保存', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally { this.setData({ saving: false }) }
  }
})
