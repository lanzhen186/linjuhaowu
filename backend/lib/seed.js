/* 三千优品 - 共享数据库种子模块（与前端 js/data.js seed 结构一致）
 * 服务端首次启动时生成初始数据库：用户（含管理员）、商品、聊天、公告。
 * 位置数据复用前端 js/geo.js（Node 下通过 global.window 模拟浏览器挂载）。
 */
'use strict';

// 前端 geo.js 是 IIFE 挂到 window；Node 下先模拟 window 再加载，结果挂在 global.SQYP_GEO
if (typeof window === 'undefined') global.window = global;
try { require('../../js/geo.js'); } catch (e) { throw new Error('geo 模块加载失败: ' + e.message); }
var Geo = global.SQYP_GEO;
if (!Geo) throw new Error('geo 模块未挂载 SQYP_GEO');

var DB_VERSION = 6;

var DEFAULT_SETTINGS = {
  siteName: '邻居好物',
  slogan: '周边三千米的儿童好物集市 · 平台免费服务',
  platformFree: true,
  platformFreeNote: '平台对买家与卖家完全免费，不收取任何服务费。交易为线下现场面对面进行，请当面验货、当面支付。',
  adminPhone: '18696162566',
  customerEmail: '40777250@qq.com',
  copyright: '阿鲸渡喃出品',
  homeBanner: {
    title: '「邻居好物」正式上线',
    content: '欢迎来到邻居好物！这里是周边三千米内的儿童好物集市，支持儿童衣服、玩具的买卖与物物交换。平台免费服务，不收取任何费用。'
  },
  about: '邻居好物是聚焦「童装」与「玩具」的儿童好物交易平台，' +
         '让周边三千米内的家长可以方便地买卖和交换儿童衣服、玩具等物品。' +
         '平台免费服务，交易由买卖双方线下现场完成。'
};

function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
function now() { return new Date().toISOString(); }

function svgImage(emoji, color1, color2, label) {
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="' + color1 + '"/>' +
    '<stop offset="100%" stop-color="' + color2 + '"/></linearGradient></defs>' +
    '<rect width="600" height="600" fill="url(#g)"/>' +
    '<text x="300" y="330" font-size="230" text-anchor="middle" dominant-baseline="middle">' + emoji + '</text>' +
    (label ? '<text x="300" y="540" font-size="34" text-anchor="middle" fill="rgba(0,0,0,.28)">' + label + '</text>' : '') +
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function seed() {
  var t = Date.now();
  function ago(min) { return new Date(t - min * 60000).toISOString(); }

  var users = [
    { id: 'u_admin', phone: '18696162566', email: '40777250@qq.com', nickname: '邻居好物官方', avatar: '&#x1F47E;', credit: 100, isAdmin: true, banned: false,
      password: 'admin888',
      location: Geo.defaultLocation(), createdAt: ago(60 * 24 * 90), bio: '平台官方账号（最高管理权限）' },
    { id: 'u_ma', phone: '13912340001', email: '', nickname: '柚子妈妈', avatar: '&#x1F469;', credit: 92, isAdmin: false, banned: false,
      password: '123456',
      location: Geo.findStreet('重庆市', '渝中区', '解放碑街道'), createdAt: ago(60 * 24 * 60), bio: '两个孩子的宝妈，东西都挺新的' },
    { id: 'u_ba', phone: '13912340002', email: '', nickname: '小树爸爸', avatar: '&#x1F466;', credit: 88, isAdmin: false, banned: false,
      password: '123456',
      location: Geo.findStreet('重庆市', '江北区', '观音桥街道'), createdAt: ago(60 * 24 * 40), bio: '娃长大了，低价出闲置' },
    { id: 'u_ci', phone: '13912340003', email: '', nickname: '雯雯妈咪', avatar: '&#x1F467;', credit: 95, isAdmin: false, banned: false,
      password: '123456',
      location: Geo.findStreet('重庆市', '南岸区', '南坪街道'), createdAt: ago(60 * 24 * 30), bio: '断舍离中，童装童鞋都有' },
    { id: 'u_dd', phone: '13912340004', email: '', nickname: '大耳朵图图爸', avatar: '&#x1F476;', credit: 84, isAdmin: false, banned: false,
      password: '123456',
      location: Geo.findStreet('成都市', '武侯区', '玉林街道'), createdAt: ago(60 * 24 * 20), bio: '成都的家长，欢迎同城交换' },
    { id: 'u_ee', phone: '13912340005', email: '', nickname: '糖糖外婆', avatar: '&#x1F474;', credit: 90, isAdmin: false, banned: false,
      password: '123456',
      location: Geo.findStreet('成都市', '锦江区', '春熙路街道'), createdAt: ago(60 * 24 * 15), bio: '孙女的衣服玩具都很新' }
  ];

  users.forEach(function (u) { u.verified = { realName: '', idCardMask: '', alipayMask: '', seed: true, verifiedAt: u.createdAt }; });

  var P = function (sellerId, category, title, brand, condition, price, originalPrice, swap, emoji2, c1, c2, cityName, districtName, streetName, desc, tags) {
    var owner = null;
    users.forEach(function (u) { if (u.id === sellerId) owner = u; });
    var loc = owner && owner.location;
    if (cityName) loc = Geo.findStreet(cityName, districtName, streetName) || loc;
    return {
      id: uid('p'), sellerId: sellerId, category: category, title: title, brand: brand,
      condition: condition, price: price, originalPrice: originalPrice || price,
      swap: !!swap, images: [svgImage(emoji2, c1, c2, title.slice(0, 8))],
      location: loc, tags: tags || [], desc: desc || title + '，成色与细节欢迎咨询卖家',
      views: Math.floor(Math.random() * 300) + 20,
      wants: [], status: 'on', comments: [],
      createdAt: ago(60 * 24 * Math.floor(Math.random() * 14) + 60)
    };
  };

  var products = [
    P('u_ma', '童装', '巴拉巴拉 儿童羽绒服 90码 九成新', '巴拉巴拉', '几乎全新', 89, 329, true, '&#x1F9E5;', '#FFE0EC', '#FFC4D8', '重庆市', '渝中区', '解放碑街道', '去年买的羽绒服，孩子今年穿小了，保暖很好，洗过几次很干净。', ['羽绒服', '90码', '保暖']),
    P('u_ma', '童装', '小猪班纳 男童卫衣套装 110码', '小猪班纳', '轻微使用', 45, 159, true, '&#x1F455;', '#D6E9FF', '#B4D4FF', '重庆市', '渝中区', '解放碑街道', '卫衣加长裤套装，棉质柔软，穿过一个秋天。', ['卫衣', '套装', '110码']),
    P('u_ci', '童装', '安奈儿 女童连衣裙 120码 全新未穿', '安奈儿', '全新', 69, 269, true, '&#x1F457;', '#FFD9F3', '#FFB8E6', '重庆市', '南岸区', '南坪街道', '生日礼物买大了，全新吊牌还在，转给有缘的小公主。', ['连衣裙', '全新', '120码']),
    P('u_ba', '童装', '迷你巴拉巴拉 男童运动鞋 28码', '迷你巴拉巴拉', '几乎全新', 55, 199, false, '&#x1F97E;', '#FFE3C4', '#FFCB96', '重庆市', '江北区', '观音桥街道', '孩子脚长得快，只穿了两次，鞋底几乎没磨损。', ['运动鞋', '28码']),
    P('u_ci', '童装', '英氏 婴儿连体衣 66cm（3件）', '英氏', '轻微使用', 39, 128, true, '&#x1F6A7;', '#E4F6E8', '#C8EED2', '重庆市', '南岸区', '南坪街道', '纯棉无骨缝制，3件一起出，适合3-6个月宝宝。', ['连体衣', '新生儿', '纯棉']),
    P('u_ma', '童装', '笛莎 女童加绒打底裤 100-110码', '笛莎', '全新', 25, 79, false, '&#x1F9F6;', '#F3D9FF', '#E4B8FF', '重庆市', '渝中区', '解放碑街道', '两条装，全新有吊牌，深色好搭配。', ['打底裤', '加绒']),
    P('u_dd', '童装', '巴拉巴拉 儿童毛衣 120码', '巴拉巴拉', '轻微使用', 42, 189, true, '&#x1F9E6;', '#FFF3C4', '#FFE6A0', '成都市', '武侯区', '玉林街道', '孩子穿着合身，起球少，适合秋天。', ['毛衣', '120码', '童装']),
    P('u_ee', '童装', 'GAP 男童牛仔裤 5T', 'GAP', '几乎全新', 35, 149, false, '&#x1F455;', '#C9D6E8', '#A8BCDA', '成都市', '锦江区', '春熙路街道', '美版版型，几乎没穿，尺码偏大适合6岁左右。', ['牛仔裤', '牛仔', 'GAP']),
    P('u_ba', '玩具', '乐高得宝 大颗粒积木 108件套', '乐高', '几乎全新', 128, 469, true, '&#x1F9F0;', '#FFD6D6', '#FFB0B0', '重庆市', '江北区', '观音桥街道', '全部零件都数过，一颗不少，消毒清洗过。', ['乐高', '积木', '大颗粒']),
    P('u_ma', '玩具', '布鲁可积木 百变工程车系列', '布鲁可', '轻微使用', 76, 259, true, '&#x1F697;', '#D6E9FF', '#B4D4FF', '重庆市', '渝中区', '解放碑街道', '男孩子很喜欢的工程车，配件齐全。', ['布鲁可', '工程车', '积木']),
    P('u_ci', '玩具', '伟易达 学习桌 双语早教机', '伟易达', '轻微使用', 95, 399, true, '&#x1F4DA;', '#E4F6E8', '#C8EED2', '重庆市', '南岸区', '南坪街道', '双语模式，孩子玩了一年，功能都正常。', ['早教机', '学习桌', '伟易达']),
    P('u_ba', '玩具', 'HAPE 木质益智串珠玩具', 'HAPE', '几乎全新', 32, 129, false, '&#x1F3A8;', '#FFE3C4', '#FFCB96', '重庆市', '江北区', '观音桥街道', '原木无味，锻炼宝宝手部精细动作。', ['HAPE', '木质', '益智']),
    P('u_ma', '玩具', '澳贝 摇铃牙胶玩具套装 8件', '澳贝', '轻微使用', 28, 109, true, '&#x1F41E;', '#FFF3C4', '#FFE6A0', '重庆市', '渝中区', '解放碑街道', '消毒柜消毒过，出牙期必备。', ['摇铃', '牙胶', '新生']),
    P('u_ci', '玩具', '费雪 小海马安抚玩偶', '费雪', '几乎全新', 35, 119, false, '&#x1F41F;', '#D6E9FF', '#B4D4FF', '重庆市', '南岸区', '南坪街道', '哄睡神器，灯光音乐都好用，电池已换新。', ['安抚', '费雪', '入睡']),
    P('u_dd', '玩具', '小猪佩奇 过家家厨房套装', '小猪佩奇', '轻微使用', 58, 228, true, '&#x1F372;', '#FFD9F3', '#FFB8E6', '成都市', '武侯区', '玉林街道', '女儿超爱这套，配件齐全可做饭。', ['过家家', '厨房', '佩奇']),
    P('u_ee', '玩具', '儿童滑板车 可折叠三档调节', '酷骑', '几乎全新', 88, 329, true, '&#x1F6B2;', '#E4F6E8', '#B8E0C0', '成都市', '锦江区', '春熙路街道', '用了一个夏天，轮子顺滑，可折叠放后备箱。', ['滑板车', '酷骑', '折叠']),
    P('u_ba', '其他', '儿童绘本 30本套装（3-6岁）', '无特定品牌', '轻微使用', 66, 240, true, '&#x1F4D6;', '#FFF3C4', '#FFE6A0', '重庆市', '江北区', '观音桥街道', '经典绘本30本，八成新，无破损缺页。', ['绘本', '套装', '早教']),
    P('u_dd', '其他', '宝宝餐椅 可拆卸餐盘', '宜家同款', '几乎全新', 49, 179, false, '&#x1F37D;', '#FFE3C4', '#FFCB96', '成都市', '武侯区', '玉林街道', '宝宝开始坐餐椅了，出餐椅一台。', ['餐椅', '辅食']),
    P('u_ci', '其他', '儿童自行车 14寸 带辅助轮', '永久', '轻微使用', 110, 399, true, '&#x1F6B4;', '#D6E9FF', '#B4D4FF', '重庆市', '南岸区', '南坪街道', '学了自行车，辅助轮可以拆，车况很好。', ['自行车', '14寸', '童车'])
  ];

  var chats = [
    {
      id: 'c_demo1', productId: products[0].id, buyerId: 'u_ci', sellerId: 'u_ma',
      messages: [
        { from: 'u_ci', to: 'u_ma', text: '你好，羽绒服还能便宜点吗？', time: ago(60 * 3) },
        { from: 'u_ma', to: 'u_ci', text: '可以呀，同城自提 80 出哈', time: ago(60 * 2) },
        { from: 'u_ci', to: 'u_ma', text: '那我可以先看看实物吗？', time: ago(60) }
      ], updatedAt: ago(55)
    },
    {
      id: 'c_demo2', productId: products[8].id, buyerId: 'u_ma', sellerId: 'u_ba',
      messages: [
        { from: 'u_ma', to: 'u_ba', text: '乐高积木有缺件吗？', time: ago(60 * 24) },
        { from: 'u_ba', to: 'u_ma', text: '没有缺，我数过两遍，放心', time: ago(60 * 20) }
      ], updatedAt: ago(60 * 20)
    }
  ];

  var notices = [
    { id: 'n1', title: '「邻居好物」正式上线', content: '欢迎来到邻居好物！这里是周边三千米内的儿童好物集市，支持儿童衣服、玩具的买卖与物物交换。', publishedAt: ago(60 * 24 * 2) }
  ];

  var feeds = [
    { id: 'f1', userId: 'u_ma', content: '请问怎么在平台上发布商品？', reply: '您好，登录后点击底部“发布”按钮，按提示填写分类、价格和位置即可发布，完全免费哦。', time: ago(60 * 26), status: 'done' }
  ];

  return {
    version: DB_VERSION,
    users: users, products: products, chats: chats,
    orders: [], comments: [], favorites: [], reviews: [],
    reports: [], feeds: feeds, notices: notices,
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  };
}

module.exports = { seed: seed, DB_VERSION: DB_VERSION, DEFAULT_SETTINGS: DEFAULT_SETTINGS };