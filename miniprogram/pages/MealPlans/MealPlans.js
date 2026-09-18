const apiStore = require('../../utils/apiStore')
const cartStore = require('../../utils/cartStore')
const { getTopSafeHeight } = require('../../utils/safeArea')

function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

Page({
  data: { topSafeHeight: 0, loading: false, plans: [], menus: [], menuIndex: 0, planDate: '', mealType: 'dinner', remark: '', history: false, mealLabels: { lunch: '午餐', dinner: '晚餐' } },
  onLoad() { this.setData({ topSafeHeight: getTopSafeHeight(), planDate: today() }); this.load() },
  onShow() { if (this.data.plans.length) this.load() },
  handleBack() { wx.navigateBack() },
  async load() {
    this.setData({ loading: true })
    try {
      const [plans, menuRes] = await Promise.all([apiStore.getMealPlans({ history: this.data.history }), apiStore.getMenuList({ available: true, page: 1, pageSize: 100 })])
      this.setData({ plans: plans || [], menus: (menuRes && menuRes.list) || [] })
    } catch (err) { wx.showToast({ title: '加载计划失败', icon: 'none' }) }
    finally { this.setData({ loading: false }) }
  },
  onDate(e) { this.setData({ planDate: e.detail.value }) },
  onMenu(e) { this.setData({ menuIndex: Number(e.detail.value || 0) }) },
  setMeal(e) { this.setData({ mealType: e.currentTarget.dataset.type }) },
  onRemark(e) { this.setData({ remark: e.detail.value }) },
  switchHistory(e) { const history = String(e.currentTarget.dataset.history) === 'true'; if (history !== this.data.history) { this.setData({ history }); this.load() } },
  async create() {
    const menu = this.data.menus[this.data.menuIndex]
    if (!menu) { wx.showToast({ title: '请先选择菜品', icon: 'none' }); return }
    try {
      await apiStore.createMealPlan({ menuId: menu._id, planDate: this.data.planDate, mealType: this.data.mealType, remark: this.data.remark })
      this.setData({ remark: '' }); await this.load(); wx.showToast({ title: '计划已创建', icon: 'success' })
    } catch (err) { wx.showToast({ title: '创建失败', icon: 'none' }) }
  },
  async confirm(e) { try { await apiStore.updateMealPlan(e.currentTarget.dataset.id, { status: 'confirmed' }); await this.load() } catch (err) { wx.showToast({ title: '确认失败', icon: 'none' }) } },
  async remove(e) { try { await apiStore.deleteMealPlan(e.currentTarget.dataset.id); await this.load() } catch (err) { wx.showToast({ title: '取消失败', icon: 'none' }) } },
  addCart(e) {
    const plan = this.data.plans.find((item) => item.id === e.currentTarget.dataset.id)
    if (!plan || !plan.menu.available) { wx.showToast({ title: '菜品已下架', icon: 'none' }); return }
    const cart = cartStore.getCart(); const menu = plan.menu
    if (cart[menu._id]) cart[menu._id].count = Number(cart[menu._id].count || 0) + 1
    else cart[menu._id] = { menu, count: 1 }
    cartStore.setCart(cart); wx.showToast({ title: '已加入购物车', icon: 'success' })
  }
})
