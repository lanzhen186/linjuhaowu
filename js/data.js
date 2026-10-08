/* ============================================================
   邻居好物（三千优品）- 数据层
   本地缓存 + 云端共享后端（Node + db.json）：
   - 启动时 bootstrap 拉取云端全量数据合并进本地缓存，A 发布 B 可见
   - 写操作（登录/发布/下单/订单流转/聊天/评价等）优先走云端 API
   - 含：用户、商品、订单、会话、留言、举报、咨询、公告、设置
   关键业务常量：
   - 平台免费服务：不收取任何服务费（买卖双方零费率）
   - 交易方式：线下现场成交（申请→已联系→完成/取消），无在线支付
   - 管理员登录电话 18696162566 / 客服邮箱 40777250@qq.com（最高权限）
   - 版权：阿鲸渡喃出品
   ============================================================ */
(function (global) {
  'use strict';

  var DB_KEY = 'sqyp_db_v1';
  var DB_VERSION = 6;   // v2：分类改名（穿搭→童装、母婴用品→玩具）+ 品牌改名（三千优品→邻居好物）；v3：位置四级（城市→区县→街道→小区）；v4：实名认证字段；v5：交易评价表；v6：账号密码登录（用户增加 password 字段）
  var listeners = [];

  // ---- 简易本地存储（localStorage 不可用时回退内存，双开同步依赖 localStorage）----
  var memory = {};
  function storageGet() {
    try {
      var raw = window.localStorage.getItem(DB_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return memory[DB_KEY] || null; }
  }
  function storageSet(val) {
    try {
      window.localStorage.setItem(DB_KEY, JSON.stringify(val));
    } catch (e) { memory[DB_KEY] = val; }
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) {} }
  }

  // 跨标签页同步（聊一聊多开场景）
  window.addEventListener('storage', function (e) {
    if (e.key === DB_KEY) {
      for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (err) {} }
    }
  });

  function onDBChange(fn) { listeners.push(fn); }

  // ---- 工具 ----
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function now() { return new Date().toISOString(); }
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var m = d.getMonth() + 1, day = d.getDate(), h = d.getHours(), min = d.getMinutes();
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return (d.getFullYear() === new Date().getFullYear() ? '' : d.getFullYear() + '-') +
           pad(m) + '-' + pad(day) + ' ' + pad(h) + ':' + pad(min);
  }

  // ---- SVG 站内插图（发布时可调用，随商品展示） ----
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

  // ---- 默认设置 ----
  var DEFAULT_SETTINGS = {
    siteName: '邻居好物',
    slogan: '周边三千米的儿童好物集市 · 平台免费服务',
    platformFree: true,          // 平台免费服务：买卖双方零服务费
    platformFreeNote: '平台对买家与卖家完全免费，不收取任何服务费；交易为线下现场面对面进行，请当面验货、当面支付。',
    adminPhone: '18696162566',       // 最高权限管理员登录电话
    customerEmail: '40777250@qq.com',// 客服邮箱（同时具备最高管理权限）
    copyright: '阿鲸渡喃出品',
    // 首页公告条（管理员可在后台「基础设置」修改标题与内容）
    homeBanner: {
      title: '「邻居好物」正式上线',
      content: '欢迎来到邻居好物！这里是周边三千米内的儿童好物集市，支持儿童衣服、玩具的买卖与物物交换。平台免费服务，交易为线下现场成交。'
    },
    about: '邻居好物是聚焦「童装」与「玩具」的儿童好物交易平台，' +
           '让周边三千米内的家长可以方便地买卖和交换儿童衣服、玩具等物品。' +
           '平台完全免费，不收取任何服务费；用户在平台上对接后线下现场交易，当面验货、当面结算。'
  };

  // ---- 种子数据 ----
  function seed() {
    var t = Date.now();
    function ago(min) { return new Date(t - min * 60000).toISOString(); }

    var users = [
      { id: 'u_admin', phone: '18696162566', email: '40777250@qq.com', nickname: '邻居好物官方', avatar: '&#x1F47E;', credit: 100, isAdmin: true, banned: false,
        password: 'admin888', // 最高管理员密码（登录方式与「江湖令」一致：手机号 + 密码）
        location: SQYP_GEO.defaultLocation(), createdAt: ago(60 * 24 * 90), bio: '平台官方账号（最高管理权限）' },
      { id: 'u_ma', phone: '13912340001', email: '', nickname: '柚子妈妈', avatar: '&#x1F469;', credit: 92, isAdmin: false, banned: false,
        password: '123456', // 种子用户初始密码
        location: SQYP_GEO.findStreet('重庆市', '渝中区', '解放碑街道'), createdAt: ago(60 * 24 * 60), bio: '两个孩子的宝妈，东西都挺新的' },
      { id: 'u_ba', phone: '13912340002', email: '', nickname: '小树爸爸', avatar: '&#x1F466;', credit: 88, isAdmin: false, banned: false,
        password: '123456',
        location: SQYP_GEO.findStreet('重庆市', '江北区', '观音桥街道'), createdAt: ago(60 * 24 * 40), bio: '娃长大了，低价出闲置' },
      { id: 'u_ci', phone: '13912340003', email: '', nickname: '雯雯妈咪', avatar: '&#x1F467;', credit: 95, isAdmin: false, banned: false,
        password: '123456',
        location: SQYP_GEO.findStreet('重庆市', '南岸区', '南坪街道'), createdAt: ago(60 * 24 * 30), bio: '断舍离中，童装童鞋都有' },
      { id: 'u_dd', phone: '13912340004', email: '', nickname: '大耳朵图图爸', avatar: '&#x1F476;', credit: 84, isAdmin: false, banned: false,
        password: '123456',
        location: SQYP_GEO.findStreet('成都市', '武侯区', '玉林街道'), createdAt: ago(60 * 24 * 20), bio: '成都的家长，欢迎同城交换' },
      { id: 'u_ee', phone: '13912340005', email: '', nickname: '糖糖外婆', avatar: '&#x1F474;', credit: 90, isAdmin: false, banned: false,
        password: '123456',
        location: SQYP_GEO.findStreet('成都市', '锦江区', '春熙路街道'), createdAt: ago(60 * 24 * 15), bio: '孙女的衣服玩具都很新' }
    ];

    // 种子用户视为历史已认证用户（新注册用户默认未认证，需实名后方可发布/购买）
    users.forEach(function (u) { u.verified = { realName: '', idCardMask: '', alipayMask: '', seed: true, verifiedAt: u.createdAt }; });

    var P = function (sellerId, category, title, brand, condition, price, originalPrice, swap, emoji, c1, c2, cityName, districtName, streetName, desc, tags) {
      var owner = null;
      users.forEach(function (u) { if (u.id === sellerId) owner = u; });
      var loc = owner && owner.location;
      if (cityName) loc = SQYP_GEO.findStreet(cityName, districtName, streetName) || loc;
      return {
        id: uid('p'), sellerId: sellerId, category: category, title: title, brand: brand,
        condition: condition, price: price, originalPrice: originalPrice || price,
        swap: !!swap, images: [svgImage(emoji, c1, c2, title.slice(0, 8))],
        location: loc, tags: tags || [], desc: desc || title + '，成色与细节欢迎咨询卖家',
        views: Math.floor(Math.random() * 300) + 20,
        wants: [], status: 'on', comments: [],
        createdAt: ago(60 * 24 * Math.floor(Math.random() * 14) + 60)
      };
    };

    var products = [
      // ===== 童装（儿童衣服） =====
      P('u_ma', '童装', '巴拉巴拉 儿童羽绒服 90码 九成新', '巴拉巴拉', '几乎全新', 89, 329, true, '&#x1F9E5;', '#FFE0EC', '#FFC4D8', '重庆市', '渝中区', '解放碑街道', '去年买的羽绒服，孩子今年穿小了，保暖很好，洗过几次很干净。', ['羽绒服', '90码', '保暖']),
      P('u_ma', '童装', '小猪班纳 男童卫衣套装 110码', '小猪班纳', '轻微使用', 45, 159, true, '&#x1F455;', '#D6E9FF', '#B4D4FF', '重庆市', '渝中区', '解放碑街道', '卫衣加长裤套装，棉质柔软，穿过一个秋天。', ['卫衣', '套装', '110码']),
      P('u_ci', '童装', '安奈儿 女童连衣裙 120码 全新未穿', '安奈儿', '全新', 69, 269, true, '&#x1F457;', '#FFD9F3', '#FFB8E6', '重庆市', '南岸区', '南坪街道', '生日礼物买大了，全新吊牌还在，转给有缘的小公主。', ['连衣裙', '全新', '120码']),
      P('u_ba', '童装', '迷你巴拉巴拉 男童运动鞋 28码', '迷你巴拉巴拉', '几乎全新', 55, 199, false, '&#x1F97E;', '#FFE3C4', '#FFCB96', '重庆市', '江北区', '观音桥街道', '孩子脚长得快，只穿了两次，鞋底几乎没磨损。', ['运动鞋', '28码']),
      P('u_ci', '童装', '英氏 婴儿连体衣 66cm（3件）', '英氏', '轻微使用', 39, 128, true, '&#x1F6A7;', '#E4F6E8', '#C8EED2', '重庆市', '南岸区', '南坪街道', '纯棉无骨缝制，3件一起出，适合3-6个月宝宝。', ['连体衣', '新生儿', '纯棉']),
      P('u_ma', '童装', '笛莎 女童加绒打底裤 100-110码', '笛莎', '全新', 25, 79, false, '&#x1F9F6;', '#F3D9FF', '#E4B8FF', '重庆市', '渝中区', '解放碑街道', '两条装，全新有吊牌，深色好搭配。', ['打底裤', '加绒']),
      P('u_dd', '童装', '巴拉巴拉 儿童毛衣 120码', '巴拉巴拉', '轻微使用', 42, 189, true, '&#x1F9E6;', '#FFF3C4', '#FFE6A0', '成都市', '武侯区', '玉林街道', '孩子穿着合身，起球少，适合秋天。', ['毛衣', '120码', '童装']),
      P('u_ee', '童装', 'GAP 男童牛仔裤 5T', 'GAP', '几乎全新', 35, 149, false, '&#x1F455;', '#C9D6E8', '#A8BCDA', '成都市', '锦江区', '春熙路街道', '美版版型，几乎没穿，尺码偏大适合6岁左右。', ['牛仔裤', '牛仔', 'GAP']),
      // ===== 玩具（儿童玩具） =====
      P('u_ba', '玩具', '乐高得宝 大颗粒积木 108件套', '乐高', '几乎全新', 128, 469, true, '&#x1F9F0;', '#FFD6D6', '#FFB0B0', '重庆市', '江北区', '观音桥街道', '全部零件都数过，一颗不少，消毒清洗过。', ['乐高', '积木', '大颗粒']),
      P('u_ma', '玩具', '布鲁可积木 百变工程车系列', '布鲁可', '轻微使用', 76, 259, true, '&#x1F697;', '#D6E9FF', '#B4D4FF', '重庆市', '渝中区', '解放碑街道', '男孩子很喜欢的工程车，配件齐全。', ['布鲁可', '工程车', '积木']),
      P('u_ci', '玩具', '伟易达 学习桌 双语早教机', '伟易达', '轻微使用', 95, 399, true, '&#x1F4DA;', '#E4F6E8', '#C8EED2', '重庆市', '南岸区', '南坪街道', '双语模式，孩子玩了一年，功能都正常。', ['早教机', '学习桌', '伟易达']),
      P('u_ba', '玩具', 'HAPE 木质益智串珠玩具', 'HAPE', '几乎全新', 32, 129, false, '&#x1F3A8;', '#FFE3C4', '#FFCB96', '重庆市', '江北区', '观音桥街道', '原木无味，锻炼宝宝手部精细动作。', ['HAPE', '木质', '益智']),
      P('u_ma', '玩具', '澳贝 摇铃牙胶玩具套装 8件', '澳贝', '轻微使用', 28, 109, true, '&#x1F41E;', '#FFF3C4', '#FFE6A0', '重庆市', '渝中区', '解放碑街道', '消毒柜消毒过，出牙期必备。', ['摇铃', '牙胶', '新生']),
      P('u_ci', '玩具', '费雪 小海马安抚玩偶', '费雪', '几乎全新', 35, 119, false, '&#x1F41F;', '#D6E9FF', '#B4D4FF', '重庆市', '南岸区', '南坪街道', '哄睡神器，灯光音乐都好用，电池已换新。', ['安抚', '费雪', '入睡']),
      P('u_dd', '玩具', '小猪佩奇 过家家厨房套装', '小猪佩奇', '轻微使用', 58, 228, true, '&#x1F372;', '#FFD9F3', '#FFB8E6', '成都市', '武侯区', '玉林街道', '女儿超爱这套，配件齐全可做饭。', ['过家家', '厨房', '佩奇']),
      P('u_ee', '玩具', '儿童滑板车 可折叠三档调节', '酷骑', '几乎全新', 88, 329, true, '&#x1F6B2;', '#E4F6E8', '#B8E0C0', '成都市', '锦江区', '春熙路街道', '用了一个夏天，轮子顺滑，可折叠放后备箱。', ['滑板车', '酷骑', '折叠']),
      // ===== 其他 =====
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
      { id: 'n1', title: '「邻居好物」正式上线', content: '欢迎来到邻居好物！这里是周边三千米内的儿童好物集市，支持儿童衣服、玩具的买卖与物物交换。平台免费服务，线下现场成交。', publishedAt: ago(60 * 24 * 2) }
    ];

    var feeds = [
      { id: 'f1', userId: 'u_ma', content: '请问怎么在平台上发布商品？', reply: '您好，登录后点击底部“发布”按钮，按提示填写分类、价格和位置即可发布，平台完全免费哦。', time: ago(60 * 26), status: 'done' }
    ];

    return {
      version: DB_VERSION,
      users: users, products: products, chats: chats,
      orders: [], comments: [], favorites: [], reviews: [],
      reports: [], feeds: feeds, notices: notices,
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    };
  }

  // ---- DB 读写 ----
  var db = null;
  // 位置数据统一补齐小区字段（旧数据无 community 时按街道默认小区补全）
  function normalizeLoc(loc) {
    if (!loc || !loc.city || !loc.district || !loc.street) return loc;
    if (loc.community) return loc;
    var p = SQYP_GEO.findPlace(loc.city, loc.district, loc.street, '');
    if (p) { loc.community = p.community; loc.lng = p.lng; loc.lat = p.lat; }
    return loc;
  }
  // 逐版迁移：v1→v2 分类/品牌改名；v2→v3 位置补齐小区
  function migrate(db) {
    db.version = db.version || 1;
    if (db.version >= DB_VERSION) return db;
    if (!db.reviews) db.reviews = [];
    if (db.products) db.products.forEach(function (p) {
      if (p.category === '穿搭') p.category = '童装';
      if (p.category === '母婴用品') p.category = '玩具';
      normalizeLoc(p.location);
    });
    var s = db.settings;
    if (s) {
      if (s.siteName === '三千优品') s.siteName = DEFAULT_SETTINGS.siteName;
      if (s.about && s.about.indexOf('三千优品') >= 0) s.about = DEFAULT_SETTINGS.about;
      if (s.serviceFeeRate != null) delete s.serviceFeeRate;
      if (s.serviceFeeNote) delete s.serviceFeeNote;
      if (!s.platformFree) s.platformFree = true;
      if (!s.platformFreeNote) s.platformFreeNote = DEFAULT_SETTINGS.platformFreeNote;
    }
    if (db.users) db.users.forEach(function (u) {
      if (u.nickname === '三千优品官方') u.nickname = '邻居好物官方';
      // v6：账号密码登录——旧用户无密码字段时补默认密码（管理员 admin888，与江湖令一致；普通用户 123456）
      if (!u.password) {
        u.password = (u.isAdmin || String(u.phone) === DEFAULT_SETTINGS.adminPhone ||
                      String(u.email || '').toLowerCase() === DEFAULT_SETTINGS.customerEmail.toLowerCase()) ?
          'admin888' : '123456';
      }
      normalizeLoc(u.location);
    });
    if (db.notices) db.notices.forEach(function (n) {
      if (n.title) n.title = n.title.split('三千优品').join('邻居好物');
      if (n.content) n.content = n.content.split('三千优品').join('邻居好物');
    });
    db.version = DB_VERSION;
    return db;
  }
  function DB() {
    if (db) return db;
    db = storageGet();
    // schema 兼容校验：旧版本或缺表时重建本地数据（首次使用自动初始化）
    if (!db || !Array.isArray(db.users) || !Array.isArray(db.products) ||
        !Array.isArray(db.chats) || !Array.isArray(db.orders)) {
      db = seed(); save();
    } else {
      var before = db.version || 1;
      migrate(db);
      if (before < DB_VERSION) save();
    }
    return db;
  }
  function save() { storageSet(db); }
  function reset() { db = seed(); save(); }

  // ---- 查询与操作 ----
  function findById(coll, id) {
    if (!db[coll]) return null;
    for (var i = 0; i < db[coll].length; i++) if (db[coll][i].id === id) return db[coll][i];
    return null;
  }
  function pushItem(coll, item) {
    if (!db[coll]) db[coll] = [];
    db[coll].push(item);
    save();
    return item;
  }
  function updateItem(coll, id, patch) {
    var item = findById(coll, id);
    if (item) { for (var k in patch) item[k] = patch[k]; save(); }
    return item;
  }
  function removeItem(coll, id) {
    if (!db[coll]) return;
    db[coll] = db[coll].filter(function (x) { return x.id !== id; });
    save();
  }
  // 账号密码登录：支持手机号 / 邮箱 / 昵称（与「江湖令」的花名/ID 登录同理，用任一账号标识均可找到用户）
  function findUserByLogin(login) {
    if (!login) return null;
    login = String(login).trim().toLowerCase();
    for (var i = 0; i < db.users.length; i++) {
      var u = db.users[i];
      if (String(u.phone).toLowerCase() === login ||
          String(u.email || '').toLowerCase() === login ||
          String(u.nickname || '').toLowerCase() === login) return u;
    }
    return null;
  }
  function findUserByPhone(phone) {
    if (!phone) return null;
    phone = String(phone).trim();
    for (var i = 0; i < db.users.length; i++) {
      if (String(db.users[i].phone) === phone) return db.users[i];
    }
    return null;
  }
  // ---- 实名认证 ----
  // u.verified 结构：{ realName, idCardMask, alipayMask, seed, verifiedAt }
  // 证件号/支付宝账号仅用于前端实时校验，落库统一只存脱敏值，不保留明文
  function isVerified(u) {
    return !!(u && u.verified && (u.verified.seed || u.verified.verifiedAt));
  }
  function verifyUser(u, info) {
    if (!u) return null;
    u.verified = {
      realName: String(info.realName || '').trim(),
      idCardMask: String(info.idCardMask || ''),
      alipayMask: String(info.alipayMask || ''),
      seed: false,
      verifiedAt: now()
    };
    save();
    return u;
  }
  function currentUser() {
    var id = sessionStorage.getItem('sqyp_current_user');
    return id ? findById('users', id) : null;
  }
  function setCurrentUser(u) {
    if (u) sessionStorage.setItem('sqyp_current_user', u.id);
    else sessionStorage.removeItem('sqyp_current_user');
  }
  function isAdminUser(u) {
    if (!u) return false;
    return !!u.isAdmin ||
           String(u.phone) === DEFAULT_SETTINGS.adminPhone ||
           String(u.email || '').toLowerCase() === DEFAULT_SETTINGS.customerEmail.toLowerCase();
  }
  // 校验账号密码（与「江湖令」一致：找到用户后比对 password；云端登录请走 cloud.login）
  function verifyPassword(u, pwd) {
    return !!(u && u.password && u.password === String(pwd || ''));
  }
  // 修改密码（个人中心入口提供的安全设置；云端改密请走 cloud.changePassword）
  function setPassword(u, pwd) {
    if (!u || !pwd || String(pwd).length < 6 || String(pwd).length > 20) return false;
    u.password = String(pwd);
    save();
    return true;
  }

  // ---- 商品 ----
  function productsOfSeller(sellerId) {
    return (db.products || []).filter(function (p) { return p.sellerId === sellerId; });
  }
  function incView(pid) {
    var p = findById('products', pid);
    if (p) { p.views = (p.views || 0) + 1; save(); }
  }

  // ---- 交易评价 ----
  // reviews 结构：{ id, orderId, productId, buyerId, sellerId, rating(1-5), content, time }
  function reviewsOfProduct(pid) {
    return (db.reviews || []).filter(function (r) { return r.productId === pid; });
  }
  function reviewsOfSeller(sellerId) {
    return (db.reviews || []).filter(function (r) { return r.sellerId === sellerId; });
  }

  // ============================================================
  // 云端同步层（Node 共享后端）
  // - API_BASE 默认本地 8000，可被 index.html 中 window.SQYP_API_BASE 覆盖
  // - 登录/发布/下单等写操作优先走云端 API；云端为真源，bootstrap 全量合并
  // ============================================================
  var TOKEN_KEY = 'sqyp_token';
  var API_BASE = ((global.SQYP_API_BASE || '').toString().replace(/\/+$/, '')) || 'http://localhost:8000';

  function getToken() {
    try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try { if (t) window.localStorage.setItem(TOKEN_KEY, t); else window.localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function api(path, opts) {
    opts = opts || {};
    var url = API_BASE + '/api' + path;
    var payload = {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    };
    var token = getToken();
    if (token) payload.headers.Authorization = 'Bearer ' + token;
    // 请求超时兜底：后端未就位 / https 混合内容拦截时 fetch 可能长期挂起，
    // 若不加超时，bootstrap 的 then/catch 都不会触发，页面保持空白。
    // 超时（或断网）统一视为"后端不可达"，走本地缓存降级渲染。
    var timer = null, ctrl = null;
    if (typeof AbortController !== 'undefined') {
      ctrl = new AbortController();
      payload.signal = ctrl.signal;
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 7000);
    }
    function done() { if (timer) { clearTimeout(timer); timer = null; } }
    return fetch(url, payload).then(function (resp) {
      done();
      return resp.json().catch(function () { return { ok: false, error: '服务器响应异常' }; });
    }).then(function (j) {
      done();
      if (!j || j.ok === false) { var e = new Error((j && j.error) || '请求失败'); e.code = (j && j.error) || ''; throw e; }
      return j;
    }).catch(function (e) {
      done();
      if (e && (e.name === 'TypeError' || e.name === 'AbortError')) throw new Error('无法连接服务器，请确认后端服务已启动（' + API_BASE + '）');
      throw e;
    });
  }

  // 云端全量合并进本地（云端为真源，整体替换各表；会话用户 id 不受影响）
  function mergeRemote(remote) {
    if (!remote || typeof remote !== 'object') return;
    var d = DB();
    ['users', 'products', 'orders', 'chats', 'comments', 'favorites', 'reviews', 'reports', 'feeds', 'notices'].forEach(function (k) {
      if (Array.isArray(remote[k])) d[k] = remote[k];
    });
    if (remote.settings) d.settings = remote.settings;
    save();
  }
  // 合并单个用户（登录/注册/认证等返回的 user）
  function mergeUser(u) {
    if (!u) return u;
    var d = DB();
    var idx = -1;
    for (var i = 0; i < d.users.length; i++) { if (d.users[i].id === u.id) { idx = i; break; } }
    if (idx >= 0) d.users[idx] = u; else d.users.push(u);
    save();
    return u;
  }
  // 合并单个订单到本地（下单/订单流转后局部更新）
  function mergeOrder(o) {
    if (!o) return;
    var d = DB();
    var idx = -1;
    for (var i = 0; i < (d.orders || []).length; i++) { if (d.orders[i].id === o.id) { idx = i; break; } }
    if (idx >= 0) d.orders[idx] = o; else d.orders.unshift(o);
    save();
  }
  // 合并单个会话到本地（创建会话/发消息后局部更新）
  function mergeChat(c) {
    if (!c) return;
    var d = DB();
    var idx = -1;
    for (var i = 0; i < (d.chats || []).length; i++) { if (d.chats[i].id === c.id) { idx = i; break; } }
    if (idx >= 0) d.chats[idx] = c; else d.chats.push(c);
    save();
  }
  // 合并单个商品到本地（发布/上下架/锁定/售出等状态变化）
  function mergeProduct(p) {
    if (!p) return;
    var d = DB();
    var idx = -1;
    for (var i = 0; i < (d.products || []).length; i++) { if (d.products[i].id === p.id) { idx = i; break; } }
    if (idx >= 0) d.products[idx] = p; else d.products.unshift(p);
    save();
  }

  var cloud = {
    baseUrl: API_BASE,
    getToken: getToken, setToken: setToken,
    api: api,
    bootstrap: function () { return api('/bootstrap'); },
    mergeRemote: mergeRemote, mergeUser: mergeUser, mergeOrder: mergeOrder, mergeChat: mergeChat, mergeProduct: mergeProduct,
    // 认证
    login: function (account, password) { return api('/auth/login', { method: 'POST', body: { account: account, password: password } }); },
    register: function (phone, password, nickname) { return api('/auth/register', { method: 'POST', body: { phone: phone, password: password, nickname: nickname } }); },
    changePassword: function (oldPwd, newPwd) { return api('/auth/change-password', { method: 'POST', body: { oldPwd: oldPwd, newPwd: newPwd } }); },
    verify: function (info) { return api('/auth/verify', { method: 'POST', body: info }); },
    // 商品
    createProduct: function (p) { return api('/products', { method: 'POST', body: p }); },
    updateProduct: function (id, patch) { return api('/products/' + id, { method: 'PATCH', body: patch }); },
    deleteProduct: function (id) { return api('/products/' + id, { method: 'DELETE' }); },
    // 订单（线下现场成交：申请 → 已联系 → 完成/取消）
    createOrder: function (productId, swapText) { return api('/orders', { method: 'POST', body: { productId: productId, swapText: swapText || '' } }); },
    orderAction: function (id, action) { return api('/orders/' + id + '/action', { method: 'POST', body: { action: action } }); },
    review: function (id, rating, content, role) { return api('/orders/' + id + '/review', { method: 'POST', body: { rating: rating, content: content || '', role: role || 'toSeller' } }); },
    // 聊天
    createChat: function (productId, sellerId) { return api('/chats', { method: 'POST', body: { productId: productId || null, sellerId: sellerId || 'u_admin' } }); },
    sendMessage: function (chatId, text) { return api('/chats/' + chatId + '/messages', { method: 'POST', body: { text: text } }); },
    // 留言
    comment: function (productId, content) { return api('/products/' + productId + '/comments', { method: 'POST', body: { content: content } }); },
    replyComment: function (productId, cid, text) { return api('/products/' + productId + '/comments', { method: 'POST', body: { reply: { cid: cid, text: text } } }); },
    // 收藏
    toggleFavorite: function (productId) { return api('/favorites', { method: 'POST', body: { productId: productId } }); },
    // 举报
    createReport: function (payload) { return api('/reports', { method: 'POST', body: payload }); },
    doneReport: function (id) { return api('/reports/' + id, { method: 'PATCH' }); },
    // 客服咨询
    createFeed: function (content) { return api('/feeds', { method: 'POST', body: { content: content } }); },
    replyFeed: function (id, reply) { return api('/feeds/' + id, { method: 'PATCH', body: { reply: reply } }); },
    // 公告 / 设置
    createNotice: function (title, content) { return api('/notices', { method: 'POST', body: { title: title, content: content } }); },
    deleteNotice: function (id) { return api('/notices/' + id, { method: 'DELETE' }); },
    updateSettings: function (s) { return api('/settings', { method: 'PATCH', body: s }); },
    // 用户管理
    adminUserAction: function (id, action) { return api('/users/' + id + '/admin-action', { method: 'POST', body: { action: action } }); },
    updateLocation: function (location) { return api('/users/me/location', { method: 'PATCH', body: { location: location } }); }
  };

  var data = {
    DB: DB, save: save, reset: reset, seed: seed, onDBChange: onDBChange,
    uid: uid, now: now, fmtTime: fmtTime, svgImage: svgImage,
    findById: findById, pushItem: pushItem, updateItem: updateItem, removeItem: removeItem,
    findUserByLogin: findUserByLogin, findUserByPhone: findUserByPhone, currentUser: currentUser, setCurrentUser: setCurrentUser,
    verifyPassword: verifyPassword, setPassword: setPassword,
    isAdminUser: isAdminUser, isVerified: isVerified, verifyUser: verifyUser,
    productsOfSeller: productsOfSeller, incView: incView,
    reviewsOfProduct: reviewsOfProduct, reviewsOfSeller: reviewsOfSeller,
    cloud: cloud,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS
  };

  global.SQYP = data;
  global.SQYP_DATA = data;
  DB(); // 模块加载即初始化，避免 findById 等在无库状态下运行
})(window);