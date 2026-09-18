const test = require('node:test')
const assert = require('node:assert/strict')
const { getMenuConflicts, filterMenusByPreferences } = require('../utils/foodPreferenceRules')

test('忌口和过敏关键词可匹配菜名与描述', () => {
  const menu = { title: '花生酱面包', desc: '含牛奶' }
  const preferences = [{ avoidIngredients: ['花生'], allergyIngredients: ['牛奶'] }]
  assert.deepEqual(getMenuConflicts(menu, preferences), ['花生', '牛奶'])
})

test('随机点餐排除双方冲突菜品', () => {
  const menus = [{ title: '虾仁炒饭' }, { title: '番茄意面' }]
  const preferences = [{ allergyIngredients: ['虾'] }, { avoidIngredients: ['香菜'] }]
  assert.deepEqual(filterMenusByPreferences(menus, preferences), [{ title: '番茄意面' }])
})

test('未共享或缺失的伴侣偏好由调用方排除后不影响规则', () => {
  assert.deepEqual(filterMenusByPreferences([{ title: '普通炒饭' }], [null]), [{ title: '普通炒饭' }])
})
