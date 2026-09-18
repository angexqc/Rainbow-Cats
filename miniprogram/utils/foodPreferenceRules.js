function normalizedTerms(preferences = []) {
  const result = []
  preferences.filter(Boolean).forEach((preference) => {
    ;['avoidIngredients', 'allergyIngredients'].forEach((key) => {
      ;(Array.isArray(preference[key]) ? preference[key] : []).forEach((value) => {
        const term = String(value || '').trim().toLowerCase()
        if (term && !result.includes(term)) result.push(term)
      })
    })
  })
  return result
}

function menuText(menu = {}) {
  return [menu.title, menu.desc, menu.categoryLabel, menu.category]
    .map((value) => String(value || '').toLowerCase()).join(' ')
}

function getMenuConflicts(menu, preferences = []) {
  const text = menuText(menu)
  return normalizedTerms(preferences).filter((term) => text.includes(term))
}

function filterMenusByPreferences(menus = [], preferences = []) {
  return menus.filter((menu) => getMenuConflicts(menu, preferences).length === 0)
}

module.exports = { getMenuConflicts, filterMenusByPreferences }
