// cloudfunctions/menuManager/index.js
const cloud = require('wx-server-sdk').cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

const COLLECTION_NAME = 'MenuList'

/**
 * 获取菜单列表
 */
exports.getMenuList = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { category, keyword, page = 1, pageSize = 20 } = event

  try {
    // 构建查询条件
    const whereConditions = [{ available: true }]

    // 添加分类筛选
    if (category) {
      whereConditions.push({ category })
    }

    // 添加关键词搜索
    if (keyword) {
      whereConditions.push({
        title: db.RegExp({
          regexp: keyword,
          options: 'i'
        })
      })
    }

    // 获取当前用户的配对信息
    const pair = await db.collection('CoupleRelation')
      .where({
        status: 'active',
        _.or: [
          { openIdA: OPENID },
          { openIdB: OPENID }
        ]
      })
      .get()

    let openIds = [OPENID] // 默认只查询自己的
    if (pair.length > 0) {
      openIds = [pair[0].openIdA, pair[0].openIdB]
    }

    // 查询菜品（自己和情侣的）
    const skip = (page - 1) * pageSize
    const result = await db.collection(COLLECTION_NAME)
      .where({
        _openid: _.in(openIds),
        ...whereConditions
      })
      .orderBy('date', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    const total = result.data.length
    const hasMore = total >= pageSize

    return {
      success: true,
      data: {
        list: result.data,
        total,
        hasMore
      }
    }
  } catch (err) {
    console.error('getMenuList error:', err)
    return {
      success: false,
      message: err.errMsg || '获取菜单列表失败'
    }
  }
}

/**
 * 根据ID获取菜品
 */
exports.getMenuById = async (event, context) => {
  const { _id } = event

  try {
    const result = await db.collection(COLLECTION_NAME).doc(_id).get()
    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    console.error('getMenuById error:', err)
    return {
      success: false,
      message: err.errMsg || '获取菜品详情失败'
    }
  }
}

/**
 * 添加菜品
 */
exports.addMenu = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { title, image, desc, credit, category } = event

  // 表单验证
  if (!title || !credit) {
    return {
      success: false,
      message: '菜品名称和价格为必填项'
    }
  }

  if (!image) {
    return {
      success: false,
      message: '请上传菜品图片'
    }
  }

  try {
    const result = await db.collection(COLLECTION_NAME)
      .add({
        _openid: OPENID,
        title,
        image,
        desc: desc || '',
        credit: Number(credit),
        category,
        available: true,
        star: false,
        date: new Date(),
        updatedAt: new Date()
      })

    return {
      success: true,
      data: {
        _id: result._id
      }
    }
  } catch (err) {
    console.error('addMenu error:', err)
    return {
      success: false,
      message: err.errMsg || '添加菜品失败'
    }
  }
}

/**
 * 更新菜品
 */
exports.updateMenu = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { _id, title, image, desc, credit, category } = event

  try {
    // 先获取菜品信息进行权限校验
    const menu = await db.collection(COLLECTION_NAME).doc(_id).get()
    if (!menu.data) {
      return {
        success: false,
        message: '菜品不存在'
      }
    }

    // 权限校验：只能更新自己创建的菜品
    if (menu.data._openid !== OPENID) {
      return {
        success: false,
        message: '只能编辑自己创建的菜品'
      }
    }

    // 构建更新数据
    const updateData = {
      updatedAt: new Date()
    }
    if (title) updateData.title = title
    if (image) updateData.image = image
    if (desc) updateData.desc = desc
    if (credit) updateData.credit = Number(credit)
    if (category) updateData.category = category

    await db.collection(COLLECTION_NAME)
      .doc(_id)
      .update({
        data: updateData
      })

    return {
      success: true
    }
  } catch (err) {
    console.error('updateMenu error:', err)
    return {
      success: false,
      message: err.errMsg || '更新菜品失败'
    }
  }
}

/**
 * 切换上架状态
 */
exports.toggleMenuStatus = async (event, context) => {
  const { _id, available } = event

  try {
    await db.collection(COLLECTION_NAME)
      .doc(_id)
      .update({
        data: {
          available,
          updatedAt: new Date()
        }
      })

    return {
      success: true
    }
  } catch (err) {
    console.error('toggleMenuStatus error:', err)
    return {
      success: false,
      message: err.errMsg || '操作失败'
    }
  }
}

/**
 * 删除菜品
 */
exports.deleteMenu = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { _id } = event

  try {
    // 先获取菜品信息进行权限校验
    const menu = await db.collection(COLLECTION_NAME).doc(_id).get()
    if (!menu.data) {
      return {
        success: false,
        message: '菜品不存在'
      }
    }

    // 权限校验：只能删除自己创建的菜品
    if (menu.data._openid !== OPENID) {
      return {
        success: false,
        message: '只能删除自己创建的菜品'
      }
    }

    await db.collection(COLLECTION_NAME).doc(_id).remove()

    return {
      success: true
    }
  } catch (err) {
    console.error('deleteMenu error:', err)
    return {
      success: false,
      message: err.errMsg || '删除菜品失败'
    }
  }
}

// 主入口
exports.main = async (event, context) => {
  const { action } = event

  switch (action) {
    case 'getMenuList':
      return await exports.getMenuList(event, context)
    case 'getMenuById':
      return await exports.getMenuById(event, context)
    case 'addMenu':
      return await exports.addMenu(event, context)
    case 'updateMenu':
      return await exports.updateMenu(event, context)
    case 'toggleMenuStatus':
      return await exports.toggleMenuStatus(event, context)
    case 'deleteMenu':
      return await exports.deleteMenu(event, context)
    default:
      return {
        success: false,
        message: '未知操作'
      }
  }
}
