/* ============================================================
   三千优品（邻居好物） - 共享后端服务
   -----------------------------------------------------------------
   - Node 内置模块实现，零第三方依赖（便于部署到 Node 托管平台）
   - 数据持久化：backend/data/db.json（原子写盘 tmp + rename）
   - 认证：账号(手机号/昵称/邮箱) + 密码；密码加盐哈希存储；Bearer token
   - 职责：商品/用户/订单/聊天/评价/举报/留言/公告/设置 全局共享
   - 角色：管理员(adminPhone/客服邮箱) 拥有管理 API；卖家管理自己商品
   - 交易：平台免费服务（无服务费）；订单为线下现场成交（申请→已联系→完成/取消），无在线支付
   - 版权：阿鲸渡喃出品
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// 可选云数据库同步（配置 POSTGRES_URL 后启用；未配置时行为与旧版一致）
const cloud = require('./lib/cloud.js');
cloud.init();

// ---------- 数据库加载 ----------
const seedMod = require('./lib/seed.js');
const seed = seedMod.seed;
const Geo = global.SQYP_GEO || null;

let db = null;
let sessions = new Map(); // token -> userId

function freshDB() {
  const d = seed();
  // 密码迁移为哈希存储（seed 中为明文）
  d.users.forEach((u) => {
    if (u.password) { u.passwordHash = hashPassword(u.password); delete u.password; }
  });
  return d;
}
function loadDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(raw);
    // 兼容旧明文密码
    db.users.forEach((u) => {
      if (u.password && !u.passwordHash) { u.passwordHash = hashPassword(u.password); delete u.password; }
    });
    return true;
  } catch (e) {
    db = freshDB();
    saveDB();
    return false;
  }
}
function saveDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1), 'utf8');
  fs.renameSync(tmp, DB_FILE);
  cloud.schedulePush(db); // 异步同步到云数据库（可选；未启用时为空操作）
}

// ---------- 工具 ----------
function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex'); }
function now() { return new Date().toISOString(); }
function hashPassword(pwd) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + pwd).digest('hex');
  return salt + '$' + hash;
}
function verifyPassword(u, pwd, ctxMsg) {
  if (!u || !u.passwordHash) return false;
  const [salt, hash] = String(u.passwordHash).split('$');
  if (!salt || !hash) return false;
  const cur = crypto.createHash('sha256').update(salt + pwd).digest('hex');
  return cur === hash;
}
function isAdminUser(u) {
  if (!u) return false;
  return !!u.isAdmin ||
    String(u.phone) === db.settings.adminPhone ||
    String(u.email || '').toLowerCase() === db.settings.customerEmail.toLowerCase();
}
const adminPhone = () => db.settings.adminPhone;
const customerEmail = () => db.settings.customerEmail;

// 脱敏：对外输出去掉密钥字段
function sanitizeUser(u) {
  if (!u) return u;
  const c = JSON.parse(JSON.stringify(u));
  delete c.password; delete c.passwordHash;
  return c;
}
// 全量公开快照（bootstrap 用；演示架构全量返回，密码/密钥剔除）
function snapshot() {
  return {
    version: db.version,
    users: (db.users || []).map(sanitizeUser),
    products: db.products || [],
    orders: db.orders || [],
    chats: db.chats || [],
    comments: db.comments || [],
    favorites: db.favorites || [],
    reviews: db.reviews || [],
    reports: db.reports || [],
    feeds: db.feeds || [],
    notices: db.notices || [],
    settings: db.settings
  };
}

// ---------- 认证 ----------
function authUser(req) {
  const h = req.headers['authorization'] || '';
  const token = h.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  const u = (db.users || []).find((x) => x.id === userId);
  return u || null;
}
function issueToken(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, userId);
  return token;
}

// ---------- 业务函数 ----------
function findUserByLogin(login) {
  if (!login) return null;
  login = String(login).trim().toLowerCase();
  return (db.users || []).find((u) =>
    String(u.phone).toLowerCase() === login ||
    String(u.email || '').toLowerCase() === login ||
    String(u.nickname || '').toLowerCase() === login);
}
function findUserById(id) { return (db.users || []).find((u) => u.id === id); }
function findProductById(id) { return (db.products || []).find((p) => p.id === id); }
function findOrderById(id) { return (db.orders || []).find((o) => o.id === id); }
// 卖家/管理员是否可操作该商品
function canManageProduct(u, p) {
  if (!u || !p) return false;
  return isAdminUser(u) || p.sellerId === u.id;
}

// ---------- 路由 ----------
async function handle(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, 'http://x');
  const seg = url.pathname.split('/').filter(Boolean); // e.g. ['api','auth','login']
  const body = await readBody(req);

  const json = (status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  };
  const ok = (data) => json(200, { ok: true, data: data });
  const fail = (msg, status) => json(status || 400, { ok: false, error: msg });

  // ---- /api/bootstrap ----
  if (seg[0] === 'api' && seg[1] === 'bootstrap') return ok(snapshot());

  // ---- auth ----
  if (seg[0] === 'api' && seg[1] === 'auth' && seg[2] === 'login' && req.method === 'POST') {
    const { account, password } = body || {};
    if (!account || !password) return fail('账号和密码不能为空');
    const u = findUserByLogin(account);
    if (!u || !verifyPassword(u, password)) return fail('账号或密码错误');
    if (u.banned) return fail('该账号已被封禁，请联系平台客服');
    return ok({ user: sanitizeUser(u), token: issueToken(u.id) });
  }
  if (seg[0] === 'api' && seg[1] === 'auth' && seg[2] === 'register' && req.method === 'POST') {
    const { phone, password, nickname } = body || {};
    if (!/^1\d{10}$/.test(String(phone || ''))) return fail('请输入正确的 11 位手机号');
    if (!password || String(password).length < 6 || String(password).length > 20) return fail('密码需为 6-20 位');
    if (findUserByPhone(phone)) return fail('该手机号已注册，请直接登录');
    const u = {
      id: uid('u'), phone: String(phone), email: '', nickname: nickname || ('邻友' + String(phone).slice(-4)),
      avatar: '&#x1F469;', credit: 80, isAdmin: false, banned: false,
      passwordHash: hashPassword(password),
      location: Geo ? Geo.defaultLocation() : { city: '重庆市', district: '渝中区', street: '解放碑街道', community: '五四路社区', lng: 106.577, lat: 29.558 },
      createdAt: now(), bio: '新来的家长',
      verified: null
    };
    db.users.push(u); saveDB();
    return ok({ user: sanitizeUser(u), token: issueToken(u.id) });
  }
  if (seg[0] === 'api' && seg[1] === 'auth' && seg[2] === 'change-password' && req.method === 'POST') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const { oldPwd, newPwd } = body || {};
    if (!verifyPassword(u, oldPwd)) return fail('原密码不正确');
    if (!newPwd || String(newPwd).length < 6 || String(newPwd).length > 20) return fail('新密码需为 6-20 位');
    u.passwordHash = hashPassword(newPwd); saveDB();
    return ok({});
  }
  if (seg[0] === 'api' && seg[1] === 'auth' && seg[2] === 'verify' && req.method === 'POST') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const { realName, idCardMask, alipayMask } = body || {};
    if (!realName || !idCardMask || !alipayMask) return fail('认证信息不完整');
    u.verified = { realName: String(realName), idCardMask: String(idCardMask), alipayMask: String(alipayMask), seed: false, verifiedAt: now() };
    saveDB();
    return ok({ user: sanitizeUser(u) });
  }

  // ---- products ----
  if (seg[0] === 'api' && seg[1] === 'products' && req.method === 'GET') {
    let list = (db.products || []).slice();
    const status = url.searchParams.get('status');
    if (status) list = list.filter((p) => p.status === status);
    return ok(list);
  }
  if (seg[0] === 'api' && seg[1] === 'products' && req.method === 'POST') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    if (u.banned) return fail('该账号已被封禁，请联系平台客服');
    if (!u.verified) return fail('发布商品前请先完成实名认证');
    const p = body || {};
    if (!p.title || !p.title.trim()) return fail('请填写标题');
    if (!(p.price > 0)) return fail('请填写正确价格');
    if (!p.category) return fail('请选择分类');
    const prod = {
      id: uid('p'), sellerId: u.id, category: p.category, title: p.title.trim(),
      brand: p.brand || '', condition: p.condition || '轻微使用',
      price: Math.round(p.price * 100) / 100, originalPrice: Math.round((p.originalPrice > p.price ? p.originalPrice : p.price) * 100) / 100,
      swap: !!p.swap, images: Array.isArray(p.images) && p.images.length ? p.images : [p.images || ''],
      location: p.location || u.location, tags: p.tags || [], desc: p.desc || '',
      views: 0, wants: [], status: 'on', comments: [], createdAt: now()
    };
    db.products.unshift(prod); saveDB();
    return ok(prod);
  }
  if (seg[0] === 'api' && seg[1] === 'products' && seg[2] && req.method === 'PATCH') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const p = findProductById(seg[2]);
    if (!p) return fail('商品不存在', 404);
    if (!canManageProduct(u, p)) return fail('无权操作该商品', 403);
    const patch = body || {};
    ['title','brand','category','condition','price','originalPrice','swap','images','location','tags','desc','status'].forEach((k) => {
      if (patch[k] !== undefined) p[k] = patch[k];
    });
    if (patch.status && ['on','off','sold'].indexOf(patch.status) < 0) return fail('无效的商品状态');
    if (patch.price !== undefined) p.price = Math.round(Number(patch.price) * 100) / 100;
    if (patch.originalPrice !== undefined) p.originalPrice = Math.round(Number(patch.originalPrice) * 100) / 100;
    saveDB();
    return ok(p);
  }
  if (seg[0] === 'api' && seg[1] === 'products' && seg[2] && req.method === 'DELETE') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const p = findProductById(seg[2]);
    if (!p) return fail('商品不存在', 404);
    if (!canManageProduct(u, p)) return fail('无权操作该商品', 403);
    db.products = db.products.filter((x) => x.id !== p.id); saveDB();
    return ok({ id: p.id });
  }

  // ---- orders ----
  if (seg[0] === 'api' && seg[1] === 'orders' && seg.length === 2 && req.method === 'GET') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const mine = (db.orders || []).filter((o) => o.buyerId === u.id || o.sellerId === u.id || isAdminUser(u));
    return ok(mine);
  }
  if (seg[0] === 'api' && seg[1] === 'orders' && seg.length === 2 && req.method === 'POST') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    if (!u.verified) return fail('购买前请先完成实名认证');
    const { productId, swapText } = body || {};
    const p = findProductById(productId);
    if (!p) return fail('商品不存在', 404);
    if (p.status !== 'on') return fail('商品已售出或已下架');
    if (p.sellerId === u.id) return fail('不能购买自己发布的商品');
    const price = p.price;
    const order = {
      id: uid('o'), orderNo: 'SQ' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10),
      productId: p.id, buyerId: u.id, sellerId: p.sellerId,
      title: p.title, image: p.images[0],
      price: price, status: 'new',
      buyerLocation: u.location, sellerLocation: p.location,
      swapText: swapText || '', createdAt: now(),
      history: [{ status: 'new', text: '买家已申请，等待卖家线下联系（平台免费服务，线下现场交易）', time: now() }]
    };
    db.orders.unshift(order);
    // 商品锁定（已被申请，等待线下成交）
    p.status = 'locked';
    saveDB();
    return ok(order);
  }
  // 订单状态流转：现场成交（申请→已联系→完成/取消），无在线支付
  if (seg[0] === 'api' && seg[1] === 'orders' && seg[2] && seg[3] === 'action' && req.method === 'POST') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const o = findOrderById(seg[2]);
    if (!o) return fail('订单不存在', 404);
    const act = (body || {}).action;
    const isBuyer = o.buyerId === u.id;
    const isSeller = o.sellerId === u.id || isAdminUser(u);
    const push = (status, text) => o.history.push({ status: status, text: text, time: now() });
    // 卖家确认已联系买家（约线下看货/现场交易）
    if (act === 'contact' && isSeller && o.status === 'new') {
      o.status = 'contacted'; o.contactedAt = now(); push('contacted', '卖家已联系买家，双方约好线下看货/现场交易'); saveDB(); return ok(o);
    }
    // 买卖双方确认成交完成
    if (act === 'done' && (isBuyer || isSeller) && o.status === 'contacted') {
      o.status = 'done'; o.doneAt = now();
      const p = findProductById(o.productId);
      if (p && p.status === 'locked') p.status = 'sold';
      push('done', (isBuyer ? '买家' : '卖家') + '确认交易完成，祝交易愉快'); saveDB(); return ok(o);
    }
    // 取消申请/交易，商品重新上架
    if (act === 'cancel' && (isBuyer || isSeller) && (o.status === 'new' || o.status === 'contacted')) {
      o.status = 'canceled';
      const p = findProductById(o.productId);
      if (p && p.status === 'locked') p.status = 'on';
      push('canceled', '交易取消，商品已重新上架'); saveDB(); return ok(o);
    }
    return fail('无权操作或订单状态不允许');
  }
  // 评价（现场交易完成后）
  if (seg[0] === 'api' && seg[1] === 'orders' && seg[2] && seg[3] === 'review' && req.method === 'POST') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const o = findOrderById(seg[2]);
    if (!o) return fail('订单不存在', 404);
    if (o.buyerId !== u.id && o.sellerId !== u.id) return fail('无权评价该订单', 403);
    if (o.status !== 'done') return fail('交易完成后才能评价');
    const { rating, content, role } = body || {};
    const r = parseInt(rating, 10);
    if (!r || r < 1 || r > 5) return fail('请选择星级');
    if (!o.reviewedBy) o.reviewedBy = {};
    o.reviewedBy[u.id] = true;
    const targetId = role === 'toSeller' ? o.sellerId : o.buyerId;
    const t = findUserById(targetId);
    if (t) { const d = r >= 4 ? 1 : (r <= 2 ? -1 : 0); t.credit = Math.max(0, (t.credit || 0) + d); }
    db.reviews.push({
      id: uid('rv'), orderId: o.id, productId: o.productId,
      buyerId: o.buyerId, sellerId: o.sellerId, role: role || 'toSeller',
      rating: r, content: content || '', time: now()
    });
    saveDB();
    return ok({});
  }

  // ---- 聊天 ----
  if (seg[0] === 'api' && seg[1] === 'chats' && req.method === 'GET') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    return ok((db.chats || []).filter((c) => c.buyerId === u.id || c.sellerId === u.id || isAdminUser(u)));
  }
  if (seg[0] === 'api' && seg[1] === 'chats' && req.method === 'POST') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const { productId, sellerId } = body || {};
    let chat = (db.chats || []).find((c) =>
      c.productId === productId && c.sellerId === sellerId &&
      (c.buyerId === u.id || c.sellerId === u.id));
    if (!chat) {
      chat = { id: uid('c'), productId: productId || null, buyerId: u.id, sellerId: sellerId || 'u_admin', messages: [], updatedAt: now() };
      db.chats.push(chat);
      // 平台客服首条问候
      if (!productId) {
        chat.messages.push({ id: uid('m'), from: 'u_admin', to: u.id, text: '您好，这里是邻居好物客服，请问有什么可以帮您？客服邮箱：' + customerEmail(), time: now(), read: false });
      }
      saveDB();
    }
    return ok(chat);
  }
  if (seg[0] === 'api' && seg[1] === 'chats' && seg[2] && seg[3] === 'messages' && req.method === 'POST') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const chat = (db.chats || []).find((c) => c.id === seg[2]);
    if (!chat) return fail('会话不存在', 404);
    if (chat.buyerId !== u.id && chat.sellerId !== u.id && !isAdminUser(u)) return fail('无权在该会话发言', 403);
    const { text, offer } = body || {};
    if (!text || !String(text).trim()) return fail('消息不能为空');
    const to = chat.buyerId === u.id ? chat.sellerId : chat.buyerId;
    chat.messages.push({ id: uid('m'), from: u.id, to: to || 'u_admin', text: String(text).trim(), offer: offer || null, time: now(), read: false });
    chat.updatedAt = now();
    // 客服自动回复
    if (chat.id.indexOf('c_platform_') === 0) {
      chat.messages.push({ id: uid('m'), from: 'u_admin', to: u.id, text: '感谢您的咨询，客服邮箱 ' + customerEmail() + ' 也已收到您的诉求，我们将尽快处理～', time: now(), read: false });
      chat.updatedAt = now();
    }
    saveDB();
    return ok(chat);
  }

  // ---- 商品留言 ---- 
  if (seg[0] === 'api' && seg[1] === 'products' && seg[2] && seg[3] === 'comments' && req.method === 'POST') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const p = findProductById(seg[2]);
    if (!p) return fail('商品不存在', 404);
    const { content, reply } = body || {};
    if (!p.comments) p.comments = [];
    if (reply) {
      const c = p.comments.find((x) => x.id === reply.cid);
      if (!c) return fail('留言不存在', 404);
      if (p.sellerId !== u.id && !isAdminUser(u)) return fail('仅卖家可回复留言', 403);
      c.reply = reply.text;
    } else {
      if (!content || !String(content).trim()) return fail('留言内容不能为空');
      p.comments.push({ id: uid('cm'), userId: u.id, content: String(content).trim(), time: now(), reply: null });
    }
    saveDB();
    return ok(p);
  }

  // ---- 想要(收藏) ----
  if (seg[0] === 'api' && seg[1] === 'favorites' && req.method === 'POST') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const { productId } = body || {};
    if (!findProductById(productId)) return fail('商品不存在', 404);
    const idx = (db.favorites || []).findIndex((f) => f.userId === u.id && f.productId === productId);
    if (idx >= 0) { db.favorites.splice(idx, 1); saveDB(); return ok({ favorite: false }); }
    db.favorites.push({ userId: u.id, productId: productId, time: now() }); saveDB();
    return ok({ favorite: true });
  }

  // ---- 举报 ----
  if (seg[0] === 'api' && seg[1] === 'reports' && req.method === 'POST') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const { productId, title, reason, content } = body || {};
    if (!productId || !reason) return fail('举报信息不完整');
    db.reports.push({ id: uid('rp'), userId: u.id, productId: productId, title: title || '', reason: reason, content: content || reason, time: now(), status: 'pending' });
    saveDB();
    return ok({});
  }
  // 举报处理
  if (seg[0] === 'api' && seg[1] === 'reports' && seg[2] && req.method === 'PATCH') {
    const u = authUser(req); if (!u || !isAdminUser(u)) return fail('无权操作', 403);
    const r = (db.reports || []).find((x) => x.id === seg[2]);
    if (!r) return fail('举报不存在', 404);
    r.status = 'done'; r.doneAt = now(); saveDB();
    return ok({});
  }

  // ---- 客服咨询 feeds ----
  if (seg[0] === 'api' && seg[1] === 'feeds' && req.method === 'POST') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const { content } = body || {};
    if (!content || !String(content).trim()) return fail('咨询内容不能为空');
    db.feeds.push({ id: uid('f'), userId: u.id, content: String(content).trim(), reply: null, time: now(), status: 'pending' });
    saveDB();
    return ok({});
  }
  if (seg[0] === 'api' && seg[1] === 'feeds' && seg[2] && req.method === 'PATCH') {
    const u = authUser(req); if (!u || !isAdminUser(u)) return fail('无权操作', 403);
    const f = (db.feeds || []).find((x) => x.id === seg[2]);
    if (!f) return fail('咨询不存在', 404);
    const { reply } = body || {};
    if (!reply) return fail('回复内容不能为空');
    f.reply = String(reply); f.status = 'done'; f.replyAt = now(); f.replyBy = u.id; saveDB();
    return ok({});
  }

  // ---- 公告 / 设置（管理员） ----
  if (seg[0] === 'api' && seg[1] === 'notices' && req.method === 'POST') {
    const u = authUser(req); if (!u || !isAdminUser(u)) return fail('无权操作', 403);
    const { title, content } = body || {};
    if (!title || !content) return fail('请填写标题和内容');
    db.notices.push({ id: uid('n'), title: String(title), content: String(content), publishedAt: now() }); saveDB();
    return ok({});
  }
  if (seg[0] === 'api' && seg[1] === 'notices' && seg[2] && req.method === 'DELETE') {
    const u = authUser(req); if (!u || !isAdminUser(u)) return fail('无权操作', 403);
    db.notices = (db.notices || []).filter((n) => n.id !== seg[2]); saveDB();
    return ok({});
  }
  if (seg[0] === 'api' && seg[1] === 'settings' && req.method === 'PATCH') {
    const u = authUser(req); if (!u || !isAdminUser(u)) return fail('无权操作', 403);
    const s = body || {};
    ['siteName','slogan','platformFree','platformFreeNote','customerEmail','copyright','homeBanner','about'].forEach((k) => {
      if (s[k] !== undefined) db.settings[k] = s[k];
    });
    saveDB();
    return ok(db.settings);
  }

  // ---- 用户管理（管理员） ----
  if (seg[0] === 'api' && seg[1] === 'users' && seg[2] && seg[3] === 'admin-action' && req.method === 'POST') {
    const u = authUser(req); if (!u || !isAdminUser(u)) return fail('无权操作', 403);
    const t = findUserById(seg[2]);
    if (!t) return fail('用户不存在', 404);
    if (String(t.phone) === adminPhone() || String(t.email || '').toLowerCase() === customerEmail().toLowerCase()) return fail('最高权限账号受保护');
    const act = (body || {}).action;
    if (act === 'ban') t.banned = true;
    else if (act === 'unban') t.banned = false;
    else if (act === 'admin') { if (u.id === t.id) return fail('不能对自己操作'); t.isAdmin = !t.isAdmin; }
    else return fail('无效操作');
    saveDB();
    return ok(sanitizeUser(t));
  }

  // 位置更新
  if (seg[0] === 'api' && seg[1] === 'users' && seg[2] === 'me' && seg[3] === 'location' && req.method === 'PATCH') {
    const u = authUser(req); if (!u) return fail('请先登录', 401);
    const { location } = body || {};
    if (!location) return fail('位置不能为空');
    u.location = location; saveDB();
    return ok(sanitizeUser(u));
  }

  return fail('接口不存在', 404);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 30 * 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function findUserByPhone(phone) {
  if (!phone) return null;
  phone = String(phone).trim();
  return (db.users || []).find((u) => String(u.phone) === phone);
}

// ---------- 启动 ----------
loadDB();
cloud.syncOnBoot(db).then((remoteDB) => {
  if (remoteDB) {
    db = remoteDB;
    // 兼容旧明文密码
    db.users.forEach((u) => {
      if (u.password && !u.passwordHash) { u.passwordHash = hashPassword(u.password); delete u.password; }
    });
    saveDB();
    console.log('已用云数据库覆盖本地数据');
  }
}).catch((e) => console.warn('云同步启动失败（继续使用本地数据）: ' + e.message));
const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: '服务器内部错误: ' + e.message }));
  });
});
server.listen(PORT, () => {
  console.log('三千优品（邻居好物）共享后端已启动: http://localhost:' + PORT);
  console.log('数据文件: ' + DB_FILE + ' | 用户数: ' + db.users.length + ' | 商品数: ' + db.products.length);
});