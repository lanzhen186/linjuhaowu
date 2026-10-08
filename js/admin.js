/* ============================================================
   邻居好物 - 管理后台
   权限：
   - 登录账号 18696162566（电话）或 40777250@qq.com（邮箱）→ 最高权限
   - 普通用户账号无后台权限（提示去用户端）
   模块：仪表盘 / 商品管理 / 订单管理 / 用户管理 / 类目与品牌 / 公告管理 /
         留言与举报 / 客服咨询 / 系统设置（平台免费、客服邮箱、版权）
   平台免费服务：不收取任何服务费；订单为线下现场成交（申请→已联系→完成/取消），无在线支付
   版权：阿鲸渡喃出品
   ============================================================ */
(function (global) {
  'use strict';

  var D = global.SQYP;
  var G = global.SQYP_GEO;

  var ADMIN_TABS = [
    { key: 'dashboard', label: '&#x1F4CA; 仪表盘' },
    { key: 'products', label: '&#x1F6D2; 商品管理' },
    { key: 'orders', label: '&#x1F4B3; 订单管理' },
    { key: 'users', label: '&#x1F464; 用户管理' },
    { key: 'cats', label: '&#x1F3E8; 类目管理' },
    { key: 'notices', label: '&#x1F4E2; 公告管理' },
    { key: 'reports', label: '&#x26A0;&#xFE0F; 留言与举报' },
    { key: 'feeds', label: '&#x1F4AC; 客服咨询' },
    { key: 'settings', label: '&#x2699;&#xFE0F; 系统设置' }
  ];

  var adminState = { tab: 'dashboard' };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n) { return Number(n || 0).toFixed(2); }
  function toast(msg) {
    var root = document.getElementById('toast-root');
    var t = el('<div class="toast">' + msg + '</div>');
    root.appendChild(t);
    setTimeout(function () { t.remove(); }, 1800);
  }
  function confirmBox(title, msg, onOk) {
    var mask = el('<div class="modal-mask"><div class="modal"><h3>' + esc(title) + ' <span class="m-close" id="m-close2">&#x2715;</span></h3>' +
      '<div style="font-size:13px;color:#555;line-height:1.8;">' + msg + '</div>' +
      '<div style="display:flex;gap:10px;margin-top:16px;">' +
        '<button class="btn-primary" style="margin:0;flex:1;background:#FFEBEE;color:#c62828;" id="m-ok">确定</button>' +
        '<button class="btn-primary" style="margin:0;flex:1;background:#f2f2f2;color:#666;" id="m-cancel">取消</button>' +
      '</div></div></div>');
    document.getElementById('modal-root').appendChild(mask);
    $('#m-close2', mask).addEventListener('click', function () { mask.remove(); });
    $('#m-cancel', mask).addEventListener('click', function () { mask.remove(); });
    $('#m-ok', mask).addEventListener('click', function () { mask.remove(); onOk(); });
  }

  // 订单状态（线下现场成交：申请 → 已联系 → 完成/取消）
  var STATUS = {
    new: ['已申请', 1], contacted: ['待交易', 2],
    done: ['已完成', 3], canceled: ['已取消', 4]
  };
  var DONE_STATUS = ['new', 'contacted', 'done']; // 计入成交统计的状态

  // ---------- 权限 ----------
  function guard(main) {
    var u = D.currentUser();
    if (!u) { main.innerHTML = '<div class="empty">未登录，无法访问管理后台</div><div style="text-align:center;"><a href="#/login" style="color:#FF8C00;">去登录</a></div>'; return null; }
    if (!D.isAdminUser(u)) {
      main.innerHTML = '<div class="empty">该账号无权访问管理后台</div><div style="text-align:center;"><button class="btn-primary" style="display:inline-block;width:auto;padding:6px 24px;margin-top:10px;" onclick="location.hash=\'#/logout\'">切换账号</button></div>';
      return null;
    }
    return u;
  }

  // ---------- 渲染入口 ----------
  function render(main) {
    var u = guard(main);
    if (!u) return;

    main.innerHTML =
      '<div class="admin-wrap">' +
        '<div class="admin-head">' +
          '<span style="font-size:22px;">&#x1F6E1;&#xFE0F;</span>' +
          '<div class="logo">邻居好物<small>管理后台 · ' + esc(D.DEFAULT_SETTINGS.copyright) + '</small></div>' +
          '<div class="right">' +
            '<span>当前：' + esc(u.nickname) + '</span>' +
            '<a href="#/home" id="go-user">用户端</a>' +
            '<a href="javascript:;" id="logout">退出</a>' +
          '</div>' +
        '</div>' +
        '<div class="admin-nav">' +
          ADMIN_TABS.map(function (t) {
            return '<a href="javascript:;" data-tab="' + t.key + '" class="' + (adminState.tab === t.key ? 'active' : '') + '">' + t.label + '</a>';
          }).join('') +
        '</div>' +
        '<div class="admin-body" id="admin-body"></div>' +
      '</div>';

    $('#logout').addEventListener('click', function () {
      D.cloud.setToken(null);
      D.setCurrentUser(null);
      location.hash = '#/login';
    });
    $all('.admin-nav a', main).forEach(function (a) {
      a.addEventListener('click', function () {
        adminState.tab = a.getAttribute('data-tab');
        renderBody(main, u);
      });
    });
    renderBody(main, u);
  }

  // ---------- 各 Tab ----------
  function renderBody(main, u) {
    var body = $('#admin-body');
    var db = D.DB();
    switch (adminState.tab) {
      case 'dashboard': tabDashboard(body, db); break;
      case 'products': tabProducts(body, db); break;
      case 'orders': tabOrders(body, db); break;
      case 'users': tabUsers(body, db); break;
      case 'cats': tabCats(body, db); break;
      case 'notices': tabNotices(body, db); break;
      case 'reports': tabReports(body, db); break;
      case 'feeds': tabFeeds(body, db, u); break;
      case 'settings': tabSettings(body, db, u); break;
    }
    window.scrollTo(0, 0);
  }

  // ===== 仪表盘 =====
  function tabDashboard(body, db) {
    var users = db.users || [];
    var products = db.products || [];
    var orders = db.orders || [];
    var dealOrders = orders.filter(function (o) { return DONE_STATUS.indexOf(o.status) >= 0; });
    var gmv = 0;
    dealOrders.forEach(function (o) { gmv += o.price || 0; });
    var activeOrders = orders.filter(function (o) { return o.status === 'new' || o.status === 'contacted'; }).length;
    var onSale = products.filter(function (p) { return p.status === 'on'; });
    var chats = db.chats || [];
    var msgCount = 0;
    chats.forEach(function (c) { msgCount += (c.messages || []).length; });

    body.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
        '<div style="font-size:15px;font-weight:700;">数据概览</div>' +
        '<div style="font-size:12px;color:#999;">更新于 ' + D.fmtTime(D.now()) + '</div>' +
      '</div>' +
      '<div class="dash-grid">' +
        '<div class="dash-card"><span class="dk-label">用户总数</span><span class="dk-value">' + users.length + '</span><span class="dk-sub">含 ' + users.filter(function (x) { return x.isAdmin; }).length + ' 个管理员</span></div>' +
        '<div class="dash-card"><span class="dk-label">商品总数</span><span class="dk-value">' + products.length + '</span><span class="dk-sub">在售 ' + onSale.length + ' · 已售 ' + products.filter(function (p) { return p.status === 'sold'; }).length + '</span></div>' +
        '<div class="dash-card"><span class="dk-label">订单总数</span><span class="dk-value">' + orders.length + '</span><span class="dk-sub">进行中 ' + activeOrders + ' · 成交 ' + orders.filter(function (o) { return o.status === 'done'; }).length + '</span></div>' +
        '<div class="dash-card"><span class="dk-label">成交总额 (GMV)</span><span class="dk-value">¥' + money(gmv) + '</span><span class="dk-sub">线下现场成交 · 无服务费</span></div>' +
        '<div class="dash-card" style="background:#EAF7E8;"><span class="dk-label">平台服务</span><span class="dk-value green">&#x2705; 免费</span><span class="dk-sub">对买卖双方零服务费</span></div>' +
        '<div class="dash-card"><span class="dk-label">聊一聊消息</span><span class="dk-value green">' + msgCount + '</span><span class="dk-sub">' + chats.length + ' 个会话</span></div>' +
      '</div>' +
      '<div class="admin-panel"><h3>&#x1F5E8;&#xFE0F; 最新公告</h3>' +
        (db.notices.length ? db.notices.slice(-3).reverse().map(function (n) {
          return '<div style="padding:8px 0;border-bottom:1px solid #f5f5f5;"><b style="font-size:13px;">' + esc(n.title) + '</b> <span style="font-size:11px;color:#bbb;margin-left:6px;">' + D.fmtTime(n.publishedAt) + '</span><div style="font-size:12px;color:#777;margin-top:4px;">' + esc(n.content) + '</div></div>';
        }).join('') : '<div style="color:#bbb;font-size:12px;">暂无公告</div>') +
      '</div>' +
      '<div class="admin-panel"><h3>&#x1F4CD; 区域覆盖（同城市/同区域/同街道/同小区）</h3>' +
        '<div style="font-size:12px;color:#666;line-height:1.9;">' +
          G.LOCATIONS.map(function (c) {
            return '<b>' + esc(c.city) + '</b>：' + c.districts.map(function (d) {
              var sts = d.streets, coms = 0;
              sts.forEach(function (st) { coms += (st.communities ? st.communities.length : 0); });
              return d.district + '（' + sts.length + ' 街道 / ' + coms + ' 小区）';
            }).join('、') + '<br>';
          }).join('') +
          '<div style="color:#999;margin-top:6px;">用户登录或在「我的-我的位置」中设定位置后，首页与搜索将按同小区/同街道/同区域/同城市筛选并显示距离，优先展示 3km 内宝贝。</div>' +
        '</div>' +
      '</div>';
  }

  // ===== 商品管理 =====
  function tabProducts(body, db) {
    var q = adminState.pq || '';
    var list = (db.products || []).filter(function (p) {
      if (!q) return true;
      return (p.title + (p.brand || '') + p.category).toLowerCase().indexOf(q.toLowerCase()) >= 0;
    });
    body.innerHTML =
      '<div class="admin-panel"><h3>商品管理（' + list.length + '）</h3>' +
        '<div class="admin-form-row">' +
          '<input type="text" id="p-q" placeholder="搜索标题 / 品牌 / 分类…" value="' + esc(q) + '">' +
          '<button id="p-search" style="background:#f2f2f2;">搜索</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-table"><table><thead><tr>' +
        '<th>商品</th><th>分类</th><th>品牌</th><th>价格</th><th>卖家</th><th>位置</th><th>状态</th><th>操作</th>' +
      '</tr></thead><tbody>' +
      (list.map(function (p) {
        var s = D.findById('users', p.sellerId);
        return '<tr>' +
          '<td style="display:flex;align-items:center;gap:8px;"><div class="t-thumb"><img src="' + p.images[0] + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;"></div><div style="max-width:160px;">' +
            '<div style="font-weight:600;">' + esc(p.title) + '</div>' +
            '<div style="font-size:11px;color:#999;">' + (p.views || 0) + ' 浏览 · ' + (p.wants ? p.wants.length : 0) + ' 想要' + (p.swap ? ' · 可交换' : '') + '</div></div></td>' +
          '<td>' + esc(p.category) + '</td><td>' + esc(p.brand || '-') + '</td>' +
          '<td style="color:#FF4C29;font-weight:700;">¥' + money(p.price) + '</td>' +
          '<td>' + esc(s ? s.nickname : '-') + '</td>' +
          '<td>' + esc(p.location ? p.location.district + '·' + p.location.street + (p.location.community ? '·' + p.location.community : '') : '-') + '</td>' +
          '<td>' + (p.status === 'on' ? '<span class="badge-status s3">在售</span>' : p.status === 'sold' ? '<span class="badge-status s0">已售</span>' : p.status === 'locked' ? '<span class="badge-status s1">已申请</span>' : '<span class="badge-status s5">下架</span>') + '</td>' +
          '<td>' +
            (p.status === 'on' ? '<button class="btn-mini warn" data-pa="off" data-id="' + p.id + '">下架</button>' : '<button class="btn-mini ok" data-pa="on" data-id="' + p.id + '">上架</button>') +
            '<button class="btn-mini danger" data-pa="del" data-id="' + p.id + '">删除</button>' +
          '</td></tr>';
      }).join('') || '<tr><td colspan="8" style="text-align:center;color:#bbb;">暂无商品</td></tr>') +
      '</tbody></table></div>';

    $('#p-search').addEventListener('click', function () {
      adminState.pq = $('#p-q').value;
      tabProducts(body, db);
    });
    $('#p-q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { adminState.pq = $('#p-q').value; tabProducts(body, db); }
    });
    $all('[data-pa]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-pa');
        var id = b.getAttribute('data-id');
        var p = D.findById('products', id);
        if (!p) return;
        if (act === 'on' || act === 'off') {
          D.cloud.updateProduct(id, { status: act === 'on' ? 'on' : 'off' }).then(function (j) {
            if (j.data) D.mergeProduct(j.data);
            return D.cloud.bootstrap();
          }).then(function (b2) {
            if (b2 && b2.data) D.mergeRemote(b2.data);
            toast(act === 'on' ? '已上架' : '已下架'); tabProducts(body, D.DB());
          }).catch(function (e) { toast(e.message); });
        } else if (act === 'del') {
          confirmBox('删除商品', '确定删除「' + esc(p.title) + '」吗？此操作不可恢复。', function () {
            D.cloud.deleteProduct(id).then(function () {
              D.removeItem('products', id);
              return D.cloud.bootstrap();
            }).then(function (b2) {
              if (b2 && b2.data) D.mergeRemote(b2.data);
              toast('已删除'); tabProducts(body, D.DB());
            }).catch(function (e) { toast(e.message); });
          });
        }
      });
    });
  }

  // ===== 订单管理 =====
  function tabOrders(body, db) {
    var list = (db.orders || []).slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    body.innerHTML =
      '<div class="admin-panel"><h3>订单管理（' + list.length + '）<span style="font-size:12px;color:#999;font-weight:400;margin-left:8px;">线下现场成交 · 无服务费 · 无在线支付</span></h3></div>' +
      '<div class="admin-table"><table><thead><tr>' +
        '<th>订单号</th><th>商品</th><th>买家</th><th>卖家</th><th>售价</th><th>状态</th><th>下单时间</th>' +
      '</tr></thead><tbody>' +
      (list.map(function (o) {
        var st = STATUS[o.status] || ['未知', 0];
        var buyer = D.findById('users', o.buyerId);
        var seller = D.findById('users', o.sellerId);
        return '<tr>' +
          '<td style="color:#999;">' + esc(o.orderNo) + '</td>' +
          '<td style="max-width:150px;"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(o.title) + '</div></td>' +
          '<td>' + esc(buyer ? buyer.nickname : '-') + '</td><td>' + esc(seller ? seller.nickname : '-') + '</td>' +
          '<td style="color:#FF4C29;font-weight:700;">¥' + money(o.price) + '</td>' +
          '<td><span class="badge-status s' + st[1] + '">' + st[0] + '</span></td>' +
          '<td>' + D.fmtTime(o.createdAt) + '</td></tr>';
      }).join('') || '<tr><td colspan="7" style="text-align:center;color:#bbb;">暂无订单</td></tr>') +
      '</tbody></table></div>';
  }

  // ===== 用户管理 =====
  function tabUsers(body, db) {
    var list = db.users || [];
    body.innerHTML =
      '<div class="admin-panel"><h3>用户管理（' + list.length + '）<span style="font-size:12px;color:#999;font-weight:400;margin-left:8px;">管理员账号于部署配置中指定</span></h3></div>' +
      '<div class="admin-table"><table><thead><tr>' +
        '<th>用户</th><th>登录方式</th><th>实名认证</th><th>位置</th><th>信用</th><th>在售</th><th>订单</th><th>加入时间</th><th>状态</th><th>操作</th>' +
      '</tr></thead><tbody>' +
      (list.map(function (u) {
        var onSell = (db.products || []).filter(function (p) { return p.sellerId === u.id; }).length;
        var orderCnt = (db.orders || []).filter(function (o) { return o.buyerId === u.id || o.sellerId === u.id; }).length;
        var isTop = String(u.phone) === D.DEFAULT_SETTINGS.adminPhone || String(u.email || '').toLowerCase() === D.DEFAULT_SETTINGS.customerEmail.toLowerCase();
        return '<tr>' +
          '<td><div class="t-thumb" style="display:inline-flex;vertical-align:middle;margin-right:6px;">' + (u.avatar || '&#x1F469;') + '</div>' +
            '<b>' + esc(u.nickname) + '</b>' + (isTop ? ' <span class="badge-status s1">最高权限</span>' : u.isAdmin ? ' <span class="badge-status s1">管理员</span>' : '') + '</td>' +
          '<td>' + esc(u.phone || '-') + '<br><span style="color:#bbb;font-size:11px;">' + esc(u.email || '-') + '</span></td>' +
          '<td>' + (D.isVerified(u)
            ? '<span class="badge-status s3">已认证</span>' + (u.verified && u.verified.realName ? '<br><span style="color:#bbb;font-size:11px;">' + esc(u.verified.realName) + ' · ' + esc(u.verified.idCardMask || '') + '</span>' : '')
            : '<span class="badge-status s5">未认证</span>') + '</td>' +
          '<td>' + esc(u.location ? u.location.city + '·' + u.location.street + (u.location.community ? '·' + u.location.community : '') : '-') + '</td>' +
          '<td>' + u.credit + '</td><td>' + onSell + '</td><td>' + orderCnt + '</td>' +
          '<td>' + D.fmtTime(u.createdAt) + '</td>' +
          '<td>' + (u.banned ? '<span class="badge-status s5">已封禁</span>' : '<span class="badge-status s3">正常</span>') + '</td>' +
          '<td>' +
            (isTop ? '<span style="color:#bbb;font-size:11px;">保护账号</span>' :
              (u.banned
                ? '<button class="btn-mini ok" data-ua="unban" data-id="' + u.id + '">解封</button>'
                : '<button class="btn-mini danger" data-ua="ban" data-id="' + u.id + '">封禁</button>') +
              '<button class="btn-mini warn" data-ua="admin" data-id="' + u.id + '">设为管理员</button>') +
          '</td></tr>';
      }).join('')) +
      '</tbody></table></div>';

    $all('[data-ua]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-ua');
        var id = b.getAttribute('data-id');
        var u = D.findById('users', id);
        if (!u) return;
        if (act === 'ban') {
          confirmBox('封禁用户', '确定封禁「' + esc(u.nickname) + '」吗？封禁后无法登录和交易。', function () {
            D.cloud.adminUserAction(id, 'ban').then(function () { return D.cloud.bootstrap(); })
              .then(function (b2) { if (b2 && b2.data) D.mergeRemote(b2.data); toast('已封禁'); tabUsers(body, D.DB()); })
              .catch(function (e) { toast(e.message); });
          });
        } else if (act === 'unban') {
          D.cloud.adminUserAction(id, 'unban').then(function () { return D.cloud.bootstrap(); })
            .then(function (b2) { if (b2 && b2.data) D.mergeRemote(b2.data); toast('已解封'); tabUsers(body, D.DB()); })
            .catch(function (e) { toast(e.message); });
        } else if (act === 'admin') {
          if (D.currentUser().id === u.id) { toast('不能对自己操作'); return; }
          confirmBox('设为管理员', '确定将「' + esc(u.nickname) + '」设为管理员吗？', function () {
            D.cloud.adminUserAction(id, 'admin').then(function () { return D.cloud.bootstrap(); })
              .then(function (b2) { if (b2 && b2.data) D.mergeRemote(b2.data); toast('已更新管理员'); tabUsers(body, D.DB()); })
              .catch(function (e) { toast(e.message); });
          });
        }
      });
    });
  }

  // ===== 类目管理 =====
  function tabCats(body, db) {
    var cats = ['童装', '玩具', '其他'];
    var rows = cats.map(function (c) {
      var ps = (db.products || []).filter(function (p) { return p.category === c; });
      var onSell = ps.filter(function (p) { return p.status === 'on'; });
      var sold = ps.filter(function (p) { return p.status === 'sold'; });
      var gmv = 0;
      (db.orders || []).forEach(function (o) {
        var p = D.findById('products', o.productId);
        if (p && p.category === c && DONE_STATUS.indexOf(o.status) >= 0) gmv += o.price || 0;
      });
      return '<div class="dash-card">' +
        '<span class="dk-label">' + (c === '童装' ? '&#x1F455; ' : c === '玩具' ? '&#x1F9F0; ' : '&#x1F4D6; ') + esc(c) + '</span>' +
        '<span class="dk-value">' + ps.length + ' 件</span>' +
        '<span class="dk-sub">在售 ' + onSell.length + ' · 已售 ' + sold.length + ' · 成交额 ¥' + money(gmv) + '</span>' +
      '</div>';
    }).join('');
    var brands = {};
    (db.products || []).forEach(function (p) {
      if (p.brand) brands[p.brand] = (brands[p.brand] || 0) + 1;
    });
    var brandRows = Object.keys(brands).map(function (b) {
      return '<tr><td>' + esc(b) + '</td><td>' + brands[b] + ' 件</td></tr>';
    }).join('');

    body.innerHTML =
      '<div class="dash-grid">' + rows + '</div>' +
      '<div class="admin-panel"><h3>品牌热度（周边 3km 正在折价销售的品牌）</h3>' +
        '<div class="admin-table"><table><thead><tr><th>品牌</th><th>在售商品数</th></tr></thead><tbody>' +
        (brandRows || '<tr><td colspan="2" style="text-align:center;color:#bbb;">暂无品牌数据</td></tr>') +
        '</tbody></table></div>' +
      '</div>' +
      '<div class="admin-panel"><h3>分类说明</h3>' +
        '<div style="font-size:12px;color:#666;line-height:1.9;">' +
        '&#x1F455; 童装：儿童衣服、鞋帽、配饰（羽绒服/卫衣/连衣裙/连体衣/运动鞋等）<br>' +
        '&#x1F9F0; 玩具：儿童玩具、喂养、出行、早教（积木/绘本/滑板车/安抚玩偶等）<br>' +
        '&#x1F4D6; 其他：书包、文具、儿童自行车、绘本等其它儿童物品<br><br>' +
        '<b>特色：</b>买家可按「同城市 / 同区域 / 同街道」筛选商品，并查看商品距离自家位置的距离；' +
        '邻居好物 = 周边三千米内的儿童衣服、玩具和其它物品的买卖与物物交换。' +
        '</div></div>';
  }

  // ===== 公告管理 =====
  function tabNotices(body, db) {
    body.innerHTML =
      '<div class="admin-panel"><h3>发布公告</h3>' +
        '<div class="admin-form-row"><input type="text" id="n-title" placeholder="公告标题"><input type="text" id="n-content" placeholder="公告内容"></div>' +
        '<button class="btn-mini ok" id="n-add" style="padding:6px 20px;">发 布</button>' +
      '</div>' +
      '<div class="admin-panel"><h3>已发布（' + (db.notices || []).length + '）</h3>' +
        (db.notices.slice().reverse().map(function (n) {
          return '<div style="display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #f5f5f5;">' +
            '<div style="flex:1;"><b style="font-size:13px;">' + esc(n.title) + '</b> <span style="font-size:11px;color:#999;">' + D.fmtTime(n.publishedAt) + '</span>' +
            '<div style="font-size:12px;color:#777;margin-top:2px;">' + esc(n.content) + '</div></div>' +
            '<button class="btn-mini danger" data-ndel="' + n.id + '">删除</button>' +
          '</div>';
        }).join('') || '<div style="color:#bbb;font-size:12px;">暂无公告</div>') +
      '</div>';

    $('#n-add').addEventListener('click', function () {
      var title = $('#n-title').value.trim();
      var content = $('#n-content').value.trim();
      if (!title || !content) { toast('请填写标题和内容'); return; }
      D.cloud.createNotice(title, content).then(function () { return D.cloud.bootstrap(); })
        .then(function (b) { if (b && b.data) D.mergeRemote(b.data); toast('公告已发布'); tabNotices(body, D.DB()); })
        .catch(function (e) { toast(e.message); });
    });
    $all('[data-ndel]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-ndel');
        confirmBox('删除公告', '确定删除该公告吗？', function () {
          D.cloud.deleteNotice(id).then(function () { return D.cloud.bootstrap(); })
            .then(function (b2) { if (b2 && b2.data) D.mergeRemote(b2.data); toast('已删除'); tabNotices(body, D.DB()); })
            .catch(function (e) { toast(e.message); });
        });
      });
    });
  }

  // ===== 留言与举报 =====
  function tabReports(body, db) {
    // 商品留言
    var allComments = [];
    (db.products || []).forEach(function (p) {
      (p.comments || []).forEach(function (c) {
        allComments.push({ p: p, c: c });
      });
    });
    // 举报（业务数据）
    var reports = db.reports || [];

    body.innerHTML =
      '<div class="admin-panel"><h3>商品留言（' + allComments.length + '）</h3>' +
        (allComments.length ? allComments.map(function (x) {
          var u = D.findById('users', x.c.userId);
          return '<div style="padding:8px 0;border-bottom:1px solid #f5f5f5;font-size:12px;">' +
            '<b>' + esc(u ? u.nickname : '用户') + '</b> 在「' + esc(x.p.title.slice(0, 16)) + '」下留言：' +
            '<span style="color:#333;">' + esc(x.c.content) + '</span>' +
            (x.c.reply ? '<span class="badge-status s3" style="margin-left:6px;">已回复</span>' : '<span class="badge-status s0" style="margin-left:6px;">待回复</span>') +
            ' <span style="color:#bbb;">' + D.fmtTime(x.c.time) + '</span></div>';
        }).join('') : '<div style="color:#bbb;font-size:12px;">暂无留言</div>') +
      '</div>' +
      '<div class="admin-panel"><h3>举报与反馈（' + reports.length + '）</h3>' +
        '<div style="font-size:12px;color:#666;line-height:1.9;">' +
          '买家/卖家可在平台留言客服（聊一聊 -> 客服中心）投诉举报违规商品或用户。<br>' +
          '举报处理流：待处理 -> 核实 -> 下架违规商品 / 封禁账号（在「商品管理」「用户管理」中执行）。<br>' +
          '客服邮箱：<b>' + esc(D.DEFAULT_SETTINGS.customerEmail) + '</b>（最高权限，任何举报邮件直通管理员）' +
        '</div>' +
        (reports.map(function (r) {
          return '<div style="padding:8px 0;border-bottom:1px solid #f5f5f5;font-size:12px;display:flex;align-items:center;gap:8px;">' +
            '<span class="badge-status ' + (r.status === 'done' ? 's3' : 's1') + '">' + (r.status === 'done' ? '已处理' : '待处理') + '</span>' +
            esc(r.content) + ' <span style="color:#bbb;">' + D.fmtTime(r.time) + '</span>' +
            (r.status !== 'done' ? '<button class="btn-mini ok" data-rdone="' + r.id + '" style="margin-left:auto;">标记已处理</button>' : '') +
          '</div>';
        }).join('')) +
      '</div>';

    $all('[data-rdone]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-rdone');
        D.cloud.doneReport(id).then(function () { return D.cloud.bootstrap(); })
          .then(function (b2) { if (b2 && b2.data) D.mergeRemote(b2.data); toast('已标记处理'); tabReports(body, D.DB()); })
          .catch(function (e) { toast(e.message); });
      });
    });
  }

  // ===== 客服咨询 =====
  function tabFeeds(body, db, admin) {
    var pendingN = (db.feeds || []).filter(function (f) { return f.status !== 'done'; }).length;
    body.innerHTML =
      '<div class="admin-panel"><h3>客服咨询（' + (db.feeds || []).length + ' 条，待回复 ' + pendingN + '）</h3>' +
        '<div style="font-size:12px;color:#666;line-height:1.9;margin-bottom:8px;">' +
          '用户可通过「我的 -> 客服中心」在线咨询或邮件 ' + esc(D.DEFAULT_SETTINGS.customerEmail) + ' 联系平台。' +
        '</div>' +
        (db.feeds.slice().reverse().map(function (f) {
          var u = D.findById('users', f.userId);
          return '<div style="padding:10px 0;border-bottom:1px solid #f5f5f5;">' +
            '<div style="font-size:12px;display:flex;gap:8px;align-items:center;">' +
              '<b>' + esc(u ? u.nickname : '用户') + '</b>' +
              '<span class="badge-status ' + (f.status === 'done' ? 's3' : 's1') + '">' + (f.status === 'done' ? '已回复' : '待回复') + '</span>' +
              '<span style="color:#bbb;">' + D.fmtTime(f.time) + '</span>' +
            '</div>' +
            '<div style="font-size:13px;color:#333;margin-top:4px;">' + esc(f.content) + '</div>' +
            (f.reply
              ? '<div style="font-size:12px;background:var(--xy-yellow-soft);border-radius:6px;padding:6px 10px;margin-top:6px;color:#6b5b00;">平台回复：' + esc(f.reply) + (f.replyAt ? ' <span style="color:#999;">(' + D.fmtTime(f.replyAt) + ')</span>' : '') + '</div>'
              : '<button class="btn-mini ok" data-freply="' + f.id + '" style="margin-top:6px;">回复</button>') +
          '</div>';
        }).join('') || '<div style="color:#bbb;font-size:12px;">暂无咨询</div>') +
      '</div>';

    $all('[data-freply]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-freply');
        var reply = prompt('回复内容：');
        if (reply) {
          D.cloud.replyFeed(id, reply).then(function () { return D.cloud.bootstrap(); })
            .then(function (b2) { if (b2 && b2.data) D.mergeRemote(b2.data); toast('已回复'); tabFeeds(body, D.DB(), admin); })
            .catch(function (e) { toast(e.message); });
        }
      });
    });
  }

  // ===== 系统设置 =====
  function tabSettings(body, db, admin) {
    var s = db.settings || D.DEFAULT_SETTINGS;
    var isTop = String(admin.phone) === D.DEFAULT_SETTINGS.adminPhone ||
                String(admin.email || '').toLowerCase() === D.DEFAULT_SETTINGS.customerEmail.toLowerCase();

    body.innerHTML =
      '<div class="admin-panel"><h3>基础设置</h3>' +
        '<div class="admin-form-row"><label style="width:80px;font-size:12px;color:#666;">网站名称</label><input type="text" id="s-name" value="' + esc(s.siteName) + '"></div>' +
        '<div class="admin-form-row"><label style="width:80px;font-size:12px;color:#666;">标语</label><input type="text" id="s-slogan" value="' + esc(s.slogan) + '"></div>' +
        '<div class="admin-form-row"><label style="width:80px;font-size:12px;color:#666;">客服邮箱</label><input type="text" id="s-mail" value="' + esc(s.customerEmail) + '"></div>' +
        '<div class="admin-form-row"><label style="width:80px;font-size:12px;color:#666;">首页公告标题</label><input type="text" id="s-banner-title" value="' + esc(((s.homeBanner || {}).title) || '') + '"></div>' +
        '<div class="admin-form-row" style="align-items:flex-start;"><label style="width:80px;font-size:12px;color:#666;">首页公告内容</label><textarea id="s-banner-content" rows="2" style="flex:1;border:1px solid #ddd;border-radius:6px;padding:8px;font-size:13px;resize:vertical;">' + esc(((s.homeBanner || {}).content) || '') + '</textarea></div>' +
        '<div class="admin-form-row"><label style="width:80px;font-size:12px;color:#666;">版权</label><input type="text" id="s-cp" value="' + esc(s.copyright) + '"></div>' +
        '<button class="btn-mini ok" id="s-save" style="padding:6px 24px;">保存设置</button>' +
      '</div>' +
      '<div class="admin-panel" style="background:#EAF7E8;"><h3>&#x2705; 平台免费服务</h3>' +
        '<div style="font-size:12px;color:#2b7a22;line-height:1.9;">' +
          esc(s.platformFreeNote || D.DEFAULT_SETTINGS.platformFreeNote || '') +
        '</div>' +
      '</div>' +
      '<div class="admin-panel"><h3>权限与安全</h3>' +
        '<div style="font-size:12px;color:#666;line-height:2;">' +
          '&#x2705; 最高权限账号（受保护，不可封禁/删除）：部署配置中指定的管理员账号。<br>' +
          '&#x2705; 管理员可访问本管理后台全部模块，并可在「用户管理」中授/撤管理员。<br>' +
          '&#x2705; 卖家账号可管理自己的商品（我的-我的发布），对申请订单执行「已联系买家」与「确认成交」操作。<br>' +
          '&#x2705; 买家账号可取消申请、确认交易完成并评价；违规账号将被封禁无法登录与交易。' +
        '</div>' +
      '</div>' +
      '<div class="admin-panel"><h3>关于</h3>' +
        '<div style="font-size:12px;color:#666;line-height:1.9;">' +
          esc(s.about) + '<br><br>' +
          '商业模式：平台免费服务，对买卖双方不收取任何服务费（0 服务费）。<br>' +
          '交易：线下现场成交（申请购买 -> 卖家线下联系 -> 当面验货结算），平台不参与收款，无在线支付环节。' +
        '</div>' +
      '</div>' +
      '<div class="copyright">' + esc(s.siteName) + ' © ' + new Date().getFullYear() + ' · 由 <span class="cp-brand">' + esc(s.copyright) + '</span> 出品</div>';

    $('#s-save').addEventListener('click', function () {
      var payload = {
        siteName: $('#s-name').value.trim() || '邻居好物',
        slogan: $('#s-slogan').value.trim(),
        customerEmail: $('#s-mail').value.trim(),
        copyright: $('#s-cp').value.trim() || '阿鲸渡喃出品',
        homeBanner: {
          title: $('#s-banner-title').value.trim() || '「邻居好物」正式上线',
          content: $('#s-banner-content').value.trim()
        }
      };
      var btn = $('#s-save');
      btn.disabled = true; btn.textContent = '保存中…';
      D.cloud.updateSettings(payload).then(function (b) {
        if (b && b.data) D.mergeRemote({ settings: b.data });
        btn.disabled = false; btn.textContent = '保存设置';
        toast('设置已保存（平台永久免费，无服务费率）');
        renderBody($('#admin-body'), admin);
      }).catch(function (e) { btn.disabled = false; btn.textContent = '保存设置'; toast(e.message); });
    });
  }

  global.SQYP_ADMIN = {
    render: render,
    state: adminState
  };
})(window);