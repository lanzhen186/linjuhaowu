/* ============================================================
   邻居好物 - 用户端主逻辑
   参考主流「童装」「玩具」板块：瀑布流、分区筛选、聊一聊、我想要、询价、交易
   特色：同小区 / 同街道 / 同区域 / 同城市筛选 + 距离展示 + 周边买卖/交换
   平台免费服务：不收取任何服务费；交易为线下现场成交（申请→已联系→完成/取消），无在线支付
   ============================================================ */
(function (global) {
  'use strict';

  // 全局异常兜底：避免偶发运行时错误导致白屏/闪退。
  // 策略：5 秒内错误数超过阈值且 UI 已挂载 → 仅做一次自动刷新恢复；否则仅友好提示。
  (function initErrorGuard() {
    var errCount = 0, errWindow = 0, reloaded = false;
    function onError(e) {
      // 资源加载失败（如图片）不视为脚本崩溃，过滤掉
      if (e && e.target && (e.target.tagName === 'IMG' || e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK')) return;
      var now = Date.now();
      if (now - errWindow > 5000) { errWindow = now; errCount = 0; }
      errCount++;
      if (errCount >= 3 && !reloaded && document.getElementById('main')) {
        reloaded = true;
        try {
          var t = document.createElement('div');
          t.style.cssText = 'position:fixed;left:0;right:0;bottom:80px;z-index:99999;text-align:center;color:#fff;font-size:13px;';
          t.style.background = 'rgba(50,50,50,.88)';
          t.style.padding = '8px 14px';
          t.style.borderRadius = '16px';
          t.style.margin = '0 auto';
          t.style.width = 'max-content';
          t.textContent = '页面出现异常，正在自动恢复…';
          document.body.appendChild(t);
        } catch (ex) {}
        setTimeout(function () { try { location.reload(); } catch (ex) {} }, 300);
        return;
      }
    }
    if (global.addEventListener) {
      global.addEventListener('error', onError, true);
      global.addEventListener('unhandledrejection', function (e) { onError({ target: null }); }, true);
    }
  })();

var D = global.SQYP;          // data
  var G = global.SQYP_GEO;      // geo

  // 登录方式：与「江湖令」一致，采用账号（手机号 / 昵称）+ 密码登录，走云端共享 API。
  // 新用户通过登录页「注册」入口设置密码（6-20 位），不再依赖短信验证码通道。

  // 协议文本（正式商用建议在法务审核后替换为完整版本）
  var AGREEMENT_TEXT = {
    terms: '《用户服务协议》\n\n一、平台服务\n邻居好物是面向周边社区家长的信息撮合平台，为用户提供儿童衣服、玩具等物品的线上展示、询价、交易对接与信息交流服务。平台自身不占有商品，不参与买卖双方的交易结算。\n\n二、用户行为规范\n1. 用户应保证发布信息的真实性、合法性，不得发布法律法规禁止交易的商品；\n2. 商品描述应与实物一致，不得虚假宣传或欺诈；\n3. 用户应通过平台完成交易对接，交易纠纷优先协商解决，协商不成的可申请平台介入处理；\n4. 用户不得实施任何危害平台正常运行的行为。\n\n三、实名认证\n发布商品或购买商品前，用户须完成实名认证。用户应确保认证信息真实有效，平台将按照隐私政策保护认证信息。\n\n四、平台免费服务\n平台对买卖双方完全免费，不收取任何服务费。交易为线下现场面对面进行：买家申请购买后，由卖家线下联系买家当面看货、当面结算，平台不参与收款。请当面验货后再付款，注意交易安全。\n\n五、免责声明\n平台仅提供信息撮合服务，不对商品的品质、真伪、二手成色作任何担保，买卖双方应自行承担交易风险；涉及侵权商品的，权利人可向平台举报。\n\n六、违规处理\n对违反本协议或国家法律法规的用户，平台有权采取屏蔽、下架商品、限制交易、封禁账号等措施。',
    privacy: '《隐私政策》\n\n一、信息收集\n1. 手机号：用于账号登录与实名认证核验；\n2. 位置信息：用于就近展示与筛选同小区/同街道商品（仅保存到街道/小区级别，不采集精确轨迹）；\n3. 实名认证信息（姓名、身份证号、联系方式）：仅用于发布与购买前的身份核验，证件号仅用于实时校验，系统脱敏存储，不对外展示；\n4. 交易信息：订单、聊天、评价等用于保障交易安全与纠纷处理。\n\n二、信息使用\n我们仅将上述信息用于提供、维护和改进平台服务，不会向无关第三方出售或非法提供个人信息。\n\n三、信息保护\n我们采取必要的技术与管理措施保护用户信息安全，未经授权不得访问、披露。\n\n四、用户权利\n用户可联系客服邮箱查阅、更正或删除其个人信息。\n\n五、未成年人保护\n本平台商品面向家庭用户，若您为未成年人，请在监护人指导下使用。'
  };

  // 实名认证协议文本（正式商用请经法务审核）
  var VERIFY_TEXT = '《实名认证协议》\n\n一、依据《中华人民共和国网络安全法》《电子商务法》等法律法规，为保障交易安全，用户发布商品或购买商品前须完成实名认证。\n\n二、用户须如实填写本人真实姓名、有效身份证件号码及本人有效联系方式（手机号或邮箱）。平台对证件号码仅作格式与校验位实时核验，系统内不保存明文证件号，仅保存脱敏结果。\n\n三、实名信息仅用于身份核验与交易安全保障，不对外展示，未经授权不向第三方提供。\n\n四、禁止冒用他人身份进行认证或交易；一经发现，平台有权拒绝认证、下架商品、限制交易直至封禁账号，并保留依法追究的权利。\n\n五、如认证信息存在错误，请联系客服邮箱更正。';

  // ---------- 状态 ----------
  var state = {
    view: 'home',
    searchKeyword: '',
    searchCategory: '全部',
    searchZone: 'street',        // community | street | district | city | all
    searchSort: 'distance',      // distance | new | price_low
    productId: null,
    chatId: null,
    orderTab: 'buying',          // buying | selling
    orderStatus: 'all',
    profileTab: 'publish',
    publishImages: [],
    publishCategory: '童装'
  };

  var COLORS = ['#FFE0EC', '#D6E9FF', '#E4F6E8', '#FFF3C4', '#FFD9F3', '#FFE3C4', '#E8DEF8', '#D8F3F0'];
  var EMOJIS = ['&#x1F9E5;', '&#x1F455;', '&#x1F457;', '&#x1F97E;', '&#x1F9E6;', '&#x1F9F0;', '&#x1F697;', '&#x1F4DA;', '&#x1F3A8;', '&#x1F41E;', '&#x1F372;', '&#x1F6B2;', '&#x1F4D6;', '&#x1F37D;', '&#x1F6B4;'];

var CATS = ['童装', '玩具', '其他'];
  var CONDITIONS = ['全新', '几乎全新', '轻微使用', '明显使用'];
  var ZONE_LABELS = { community: '同小区', street: '同街道', district: '同区域', city: '同城市', all: '全城' };

  // ---------- DOM 工具 ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function toast(msg) {
    var root = $('#toast-root');
    var t = el('<div class="toast">' + msg + '</div>');
    root.appendChild(t);
    setTimeout(function () { t.remove(); }, 1800);
  }
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n) { return Number(n || 0).toFixed(2); }

  function currentUser() { return D.currentUser(); }
  function requireLogin() {
    var u = currentUser();
    if (!u) { toast('请先登录'); setTimeout(function () { location.hash = '#/login'; }, 400); return null; }
    if (u.banned) { toast('该账号已被封禁，请联系客服'); return null; }
    return u;
  }

  // ---------- 实名认证（平台实名） ----------
  // 身份证号码校验：GB11643-1999 18 位 + 校验位
  function validIdCard(id) {
    if (!/^\d{17}[\dXx]$/.test(id)) return false;
    var y = +id.slice(6, 10), m = +id.slice(10, 12), d = +id.slice(12, 14);
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
    var dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false;
    var w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    var code = '10X98765432';
    var sum = 0;
    for (var i = 0; i < 17; i++) sum += (+id[i]) * w[i];
    return code[sum % 11] === id[17].toUpperCase();
  }
  // 联系方式：手机号或邮箱
  function validContact(v) {
    return /^1\d{10}$/.test(v) ||
      /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v);
  }
  // 未实名用户弹出认证窗，认证成功后执行 cb（认证走云端 API）
  function requireVerified(u, cb) {
    if (!u) { toast('请先登录'); return; }
    if (u.banned) { toast('该账号已被封禁，请联系客服'); return; }
    if (D.isVerified(u)) { if (cb) cb(); return; }
    var html = '<div class="modal-mask"><div class="modal" style="max-width:340px;">' +
      '<h3>平台实名认证 <span class="m-close" id="m-close">&#x2715;</span></h3>' +
      '<div class="verify-tip">为保障交易安全，发布商品或购买商品前须完成实名认证。认证信息仅用于身份核验，证件号脱敏存储、不对外展示。</div>' +
      '<div class="verify-form">' +
        '<div class="vf-row"><label>真实姓名</label><input id="v-name" maxlength="20" placeholder="与身份证一致"></div>' +
        '<div class="vf-row"><label>身份证号</label><input id="v-id" maxlength="18" placeholder="18 位公民身份号码"></div>' +
        '<div class="vf-row"><label>联系手机/邮箱</label><input id="v-alipay" placeholder="手机号或邮箱"></div>' +
        '<div class="vf-agree"><label><input type="checkbox" id="v-agree"> 我已阅读并同意 <a href="javascript:;" id="v-agreement" style="color:#1677FF;">《实名认证协议》</a> 与 <a href="javascript:;" id="v-privacy" style="color:#1677FF;">《隐私政策》</a></label></div>' +
        '<button class="btn-primary" id="v-submit" style="width:100%;">提交认证</button>' +
      '</div></div></div>';
    var mask = el(html);
    $('#modal-root').appendChild(mask);
    $('#m-close').addEventListener('click', function () { mask.remove(); });
    $('#v-agreement').addEventListener('click', function (e) { e.preventDefault(); alertBox('实名认证协议', VERIFY_TEXT); });
    $('#v-privacy').addEventListener('click', function (e) { e.preventDefault(); alertBox('隐私政策', AGREEMENT_TEXT.privacy); });
    $('#v-submit').addEventListener('click', function () {
      var name = $('#v-name').value.trim();
      var idRaw = $('#v-id').value.trim();
      var contact = $('#v-alipay').value.trim();
      if (!/^[\u4e00-\u9fa5·]{2,20}$/.test(name)) { toast('请填写与身份证一致的真实姓名'); return; }
      if (!validIdCard(idRaw)) { toast('身份证号校验不通过，请核对后重试'); return; }
      if (!validContact(contact)) { toast('请填写正确的联系手机号或邮箱'); return; }
      if (!$('#v-agree').checked) { toast('请先阅读并同意实名认证协议'); return; }
      // 仅保存脱敏值，不落明文证件号
      var idMask = idRaw.slice(0, 4) + '**********' + idRaw.slice(-4);
      var ctMask = contact.indexOf('@') > 0
        ? contact.slice(0, 2) + '***' + contact.slice(contact.indexOf('@'))
        : contact.slice(0, 3) + '****' + contact.slice(-4);
      var btn = $('#v-submit');
      btn.disabled = true; btn.textContent = '认证中…';
      D.cloud.verify({ realName: name, idCardMask: idMask, alipayMask: ctMask }).then(function (j) {
        if (j.data && j.data.user) D.mergeUser(j.data.user);
        mask.remove();
        toast('实名认证成功');
        if (cb) cb();
      }).catch(function (e) { btn.disabled = false; btn.textContent = '提交认证'; toast(e.message); });
    });
  }

// 当前定位（未登录用默认位置；旧数据缺小区时自动补齐）
  function myLocation() {
    var u = currentUser();
    if (u && u.location) return G.normalize(u.location);
    return G.defaultLocation();
  }

  // ---------- 商品与距离 ----------
  function prodDist(p) {
    var m = myLocation();
    if (!p.location || !m) return null;
    return G.distance(m.lng, m.lat, p.location.lng, p.location.lat);
  }
  function prodWanted(p) {
    var u = currentUser();
    if (!u) return false;
    var favs = D.DB().favorites || [];
    return favs.some(function (f) { return f.userId === u.id && f.productId === p.id; });
  }
  function sellerOf(p) { return D.findById('users', p.sellerId); }
  function fmtDist(m) { return m == null ? '-' : G.fmtDist(m); }
  function inScope(p, zone) {
    var m = myLocation();
    if (!p.location || !m) return zone === 'all';
    return G.sameScope(m, p.location, zone);
  }
  function prodCardHtml(p, opts) {
    opts = opts || {};
    var u = currentUser();
    var dist = prodDist(p);
    var s = sellerOf(p);
    var off = p.originalPrice > p.price;
    var isMine = u && p.sellerId === u.id;
return '<div class="prod-card" data-pid="' + p.id + '">' +
      '<div class="thumb">' +
        (p.images && p.images[0] ? '<img loading="lazy" src="' + p.images[0] + '" alt="' + esc(p.title) + '">' : '') +
        (p.swap ? '<span class="swap-tag">可交换</span>' : '') +
        (off ? '<span class="disc-tag">' + Math.round((1 - p.price / p.originalPrice) * 100) + '% OFF</span>' : '') +
      '</div>' +
      '<div class="body">' +
        '<div class="title">' + esc(p.title) + '</div>' +
        '<div class="price">¥' + money(p.price) + (off ? ' <small>¥' + money(p.originalPrice) + '</small>' : '') + '</div>' +
'<div class="meta">' +
          '<span class="dist">' + (opts.showDist !== false ? '&#x1F4CD; ' + fmtDist(dist) : '') + ' ' + esc(p.location ? (p.location.street + (p.location.community ? '·' + p.location.community : '')) : '') + '</span>' +
          '<span class="wants"><i>&#x2764;</i> ' + (p.wants ? p.wants.length : 0) + '人想要</span>' +
        '</div>' +
      '</div></div>';
  }

  function feedHtml(list, opts) {
    if (!list.length) return '<div class="empty">这里空空如也，换个筛选看看吧</div>';
    return list.map(function (p) { return prodCardHtml(p, opts); }).join('');
  }

  // ---------- 分区条（默认置顶显示在最前端） ----------
  function zoneBarHtml() {
    return '<div class="zone-bar">' +
      ['community', 'street', 'district', 'city', 'all'].map(function (z) {
        return '<span class="zone-chip' + (state.searchZone === z ? ' active' : '') + '" data-zone="' + z + '">' +
          '<span class="loc-ico">&#x1F4CD;</span>' + ZONE_LABELS[z] + '</span>';
      }).join('') +
      '<span style="flex-shrink:0;font-size:11px;color:#8a6d00;margin-left:auto;">' + esc(myLocation().city + '·' + myLocation().district + '·' + myLocation().street + (myLocation().community ? '·' + myLocation().community : '')) + '</span>' +
      '</div>';
  }

  // 首页商品：优先展示同小区/同街道/同区域（按 distance 排序，3km 内置顶）
  function homeProducts() {
    var db = D.DB();
    var list = (db.products || []).filter(function (p) { return p.status === 'on'; });
    var m = myLocation();
    function scopeRank(p) {
      if (!p.location || !m) return 9;
      if (G.sameScope(m, p.location, 'community')) return 0;
      if (G.sameScope(m, p.location, 'street')) return 1;
      if (G.sameScope(m, p.location, 'district')) return 2;
      if (G.sameScope(m, p.location, 'city')) return 3;
      return 4;
    }
    list.sort(function (a, b) {
      var ra = scopeRank(a), rb = scopeRank(b);
      if (ra !== rb) return ra - rb;
      var da = prodDist(a), db_ = prodDist(b);
      if (da == null) return 1; if (db_ == null) return -1;
      return da - db_;
    });
    return list;
  }

  // ---------- 视图渲染 ----------
  function render() {
    var main = $('#main');
    var u = currentUser();
    // 底部导航
    var tabbar = $('#tabbar');
    if (state.view === 'login' || state.view === 'product' || state.view.indexOf('admin') === 0) {
      tabbar.hidden = true;
    } else {
      tabbar.hidden = false;
      $all('.tab-item', tabbar).forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('data-tab') === state.view);
      });
    }
    // 消息角标
    var nb = $('#msg-badge');
    var unread = 0;
    if (u) {
      unread = unreadCount(u.id);
    }
    if (unread > 0) { nb.hidden = false; nb.textContent = unread > 99 ? '99+' : unread; }
    else nb.hidden = true;

    switch (state.view) {
      case 'login': renderLogin(main); break;
      case 'home': renderHome(main); break;
      case 'search': renderSearch(main); break;
      case 'product': renderProduct(main); break;
      case 'publish': renderPublish(main); break;
      case 'messages': renderMessages(main); break;
      case 'chat': renderChat(main); break;
      case 'orders': renderOrders(main); break;
      case 'profile': renderProfile(main); break;
      case 'admin': renderAdminView(main); break;
      default: renderHome(main);
    }
    window.scrollTo(0, 0);
  }

  // ================= 登录 =================
function renderLogin(main) {
    main.innerHTML =
      '<div class="auth-page">' +
        '<div class="auth-logo">' +
          '<div class="name">邻居好物</div>' +
          '<div class="slogan">周边三千米的儿童好物集市 · 平台免费</div>' +
        '</div>' +
        '<div class="auth-tabs">' +
          '<button class="auth-tab active" id="tab-login" type="button">登 录</button>' +
          '<button class="auth-tab" id="tab-register" type="button">注 册</button>' +
        '</div>' +
        '<div id="form-login">' +
          '<input class="auth-input" id="auth-login" type="text" maxlength="30" placeholder="手机号 / 昵称" value="">' +
          '<input class="auth-input" id="auth-pwd" type="password" maxlength="20" placeholder="密码（6-20 位）">' +
          '<button class="auth-submit" id="auth-submit" type="button">登 录</button>' +
        '</div>' +
        '<div id="form-register" style="display:none;">' +
          '<input class="auth-input" id="reg-phone" type="tel" maxlength="11" placeholder="手机号（11 位）">' +
          '<input class="auth-input" id="reg-pwd" type="password" maxlength="20" placeholder="设置密码（6-20 位）">' +
          '<input class="auth-input" id="reg-pwd2" type="password" maxlength="20" placeholder="确认密码">' +
          '<button class="auth-submit" id="reg-submit" type="button">注册并登录</button>' +
        '</div>' +
        '<div class="auth-agree">登录即代表您已阅读并同意 <a href="javascript:;" id="auth-agree-terms">《用户服务协议》</a> 与 <a href="javascript:;" id="auth-agree-privacy">《隐私政策》</a></div>' +
        '<div class="auth-service">客服邮箱：' + esc(D.DEFAULT_SETTINGS.customerEmail) + '</div>' +
      '</div>';

    // tab 切换（与「江湖令」的登录/实名注册一致：账号 + 密码）
    function switchTab(which) {
      var isLogin = which === 'login';
      $('#tab-login').classList.toggle('active', isLogin);
      $('#tab-register').classList.toggle('active', !isLogin);
      $('#form-login').style.display = isLogin ? '' : 'none';
      $('#form-register').style.display = isLogin ? 'none' : '';
    }
    $('#tab-login').addEventListener('click', function () { switchTab('login'); });
    $('#tab-register').addEventListener('click', function () { switchTab('register'); });

    $('#auth-agree-terms').addEventListener('click', function (e) { e.preventDefault(); alertBox('用户服务协议', AGREEMENT_TEXT.terms); });
    $('#auth-agree-privacy').addEventListener('click', function (e) { e.preventDefault(); alertBox('隐私政策', AGREEMENT_TEXT.privacy); });

    // 登录：账号（手机号 / 昵称）+ 密码（走云端 API，登录态为 Bearer token）
    function doLogin() {
      var login = $('#auth-login').value.trim();
      var pwd = $('#auth-pwd').value;
      if (!login) { toast('请输入手机号或昵称'); return; }
      if (!pwd) { toast('请输入密码'); return; }
      var btn = $('#auth-submit');
      btn.disabled = true; btn.textContent = '登录中…';
      D.cloud.login(login, pwd).then(function (j) {
        var u = j.data && j.data.user;
        var token = j.data && j.data.token;
        if (token) D.cloud.setToken(token);
        if (u) D.mergeUser(u);
        D.setCurrentUser(u);
        state.view = D.isAdminUser(u) ? 'admin' : 'home';
        location.hash = D.isAdminUser(u) ? '#/admin' : '#/home';
        toast('欢迎回来，' + (u ? u.nickname : ''));
        render();
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = '登 录';
        toast(e && e.message ? e.message : '账号或密码错误');
      });
    }
    $('#auth-submit').addEventListener('click', doLogin);
    $('#auth-pwd').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

    // 注册：手机号 + 设置密码 + 确认密码（注册即登录，不再依赖短信验证码，走云端 API）
    function doRegister() {
      var ph = $('#reg-phone').value.trim();
      var p1 = $('#reg-pwd').value;
      var p2 = $('#reg-pwd2').value;
      if (!/^1\d{10}$/.test(ph)) { toast('请输入正确的 11 位手机号'); return; }
      if (p1.length < 6 || p1.length > 20) { toast('密码需为 6-20 位'); return; }
      if (p1 !== p2) { toast('两次输入的密码不一致'); return; }
      var btn = $('#reg-submit');
      btn.disabled = true; btn.textContent = '注册中…';
      D.cloud.register(ph, p1, '').then(function (j) {
        var u = j.data && j.data.user;
        var token = j.data && j.data.token;
        if (token) D.cloud.setToken(token);
        if (u) D.mergeUser(u);
        D.setCurrentUser(u);
        state.view = 'home';
        location.hash = '#/home';
        toast('注册成功，欢迎来到邻居好物！');
        render();
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = '注册并登录';
        toast(e && e.message ? e.message : '注册失败');
      });
    }
    $('#reg-submit').addEventListener('click', doRegister);
    $('#reg-pwd2').addEventListener('keydown', function (e) { if (e.key === 'Enter') doRegister(); });
  }

  // ================= 首页 =================
  function renderHome(main) {
    var db = D.DB();
    var prods = homeProducts();
var catEntrance = [
      { name: '全部', emoji: '&#x1F3EC;', cls: '全部' },
      { name: '童装', emoji: '&#x1F455;', cls: '童装' },
      { name: '玩具', emoji: '&#x1F9F0;', cls: '玩具' },
      { name: '其他', emoji: '&#x1F4D6;', cls: '其他' }
    ];
    // 首页公告条：优先使用管理员在后台配置的 homeBanner，未配置时回退公告列表最后一条
    var banner = db.settings && db.settings.homeBanner;
    var notice = (banner && banner.title) ? banner : db.notices[db.notices.length - 1];

    main.innerHTML =
      '<div class="topbar">' +
'<div class="logo">邻居好物<small>周边3km儿童好物集市</small></div>' +
        '<a class="search-box" href="#/search"><span>&#x1F50D; 搜童装 / 玩具 / 好物</span></a>' +
        (db.notices && db.notices.length ? '<a href="#/search" class="top-ico" title="公告">&#x1F4E2;</a>' : '') +
      '</div>' +
      zoneBarHtml() +
      '<div class="cat-grid">' +
        catEntrance.map(function (c) {
          return '<a class="cat-item" href="#/search" data-cat="' + c.name + '">' +
            '<div class="cat-ico cat-' + c.cls + '">' + c.emoji + '</div><span>' + c.name + '</span></a>';
        }).join('') +
      '</div>' +
      (notice ? '<div class="notice-bar" style="background:#FFF6C2;font-size:12px;color:#6b5b00;padding:8px 14px;margin:0 10px 8px;border-radius:8px;">&#x1F4E2; <b>' + esc(notice.title) + '</b> ' + esc(notice.content) + '</div>' : '') +
      '<div class="sec-head"><b>&#x1F4CD; 附近好物</b><span style="font-size:12px;">按距离优先 · 3km甄选</span></div>' +
      '<div class="feed" id="home-feed">' + feedHtml(prods.slice(0, 20)) + '</div>' +
      '<div class="copyright">平台免费服务 · 由 <span class="cp-brand">阿鲸渡喃</span> 出品</div>';

    bindFeedClicks(main);
    bindZoneBar(main);
    $all('.cat-item', main).forEach(function (a) {
      a.addEventListener('click', function () {
        state.searchCategory = a.getAttribute('data-cat');
        state.searchKeyword = '';
      });
    });
  }

  // ================= 搜索 =================
  function renderSearch(main) {
    var db = D.DB();
    var kw = state.searchKeyword.trim();
    var list = (db.products || []).filter(function (p) {
      if (p.status !== 'on') return false;
      if (state.searchCategory !== '全部' && p.category !== state.searchCategory) return false;
      if (kw) {
        var hay = (p.title + ' ' + (p.brand || '') + ' ' + (p.tags || []).join(' ')).toLowerCase();
        if (hay.indexOf(kw.toLowerCase()) < 0) return false;
      }
      if (state.searchZone !== 'all' && !inScope(p, state.searchZone)) return false;
      return true;
    });
    var m = myLocation();
function rank(p) {
      if (!p.location || !m) return 99;
      if (G.sameScope(m, p.location, 'community')) return 0;
      if (G.sameScope(m, p.location, 'street')) return 1;
      if (G.sameScope(m, p.location, 'district')) return 2;
      if (G.sameScope(m, p.location, 'city')) return 3;
      return 4;
    }
    var sort = state.searchSort;
    if (sort === 'distance') list.sort(function (a, b) {
      var ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      var da = prodDist(a), dbb = prodDist(b);
      if (da == null) return 1; if (dbb == null) return -1; return da - dbb;
    });
    else if (sort === 'new') list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    else if (sort === 'price_low') list.sort(function (a, b) { return a.price - b.price; });

    var hotWords = ['羽绒服', '乐高', '连衣裙', '滑板车', '绘本', '积木'];

    main.innerHTML =
      '<div class="search-head">' +
        '<input class="search-input" id="search-input" type="text" placeholder="搜童装 / 玩具 / 好物" value="' + esc(kw) + '">' +
        '<button class="search-btn" id="search-go">搜索</button>' +
      '</div>' +
      '<div style="background:#fff;padding:0 12px;">' + zoneBarHtml() + '</div>' +
      '<div class="filter-bar">' +
'<span class="f' + (state.searchCategory === '全部' ? ' active' : '') + '" data-cat="全部">全部</span>' +
        '<span class="f' + (state.searchCategory === '童装' ? ' active' : '') + '" data-cat="童装">童装</span>' +
        '<span class="f' + (state.searchCategory === '玩具' ? ' active' : '') + '" data-cat="玩具">玩具</span>' +
        '<span class="f' + (state.searchCategory === '其他' ? ' active' : '') + '" data-cat="其他">其他</span>' +
        '<span style="flex:1"></span>' +
        '<span class="f' + (sort === 'distance' ? ' active' : '') + '" data-sort="distance">距离<i class="arr">&#9662;</i></span>' +
        '<span class="f' + (sort === 'new' ? ' active' : '') + '" data-sort="new">最新<i class="arr">&#9662;</i></span>' +
        '<span class="f' + (sort === 'price_low' ? ' active' : '') + '" data-sort="price_low">价格<i class="arr">&#9662;</i></span>' +
      '</div>' +
      (kw ? '' : '<div style="background:#fff;padding:12px 14px;font-size:13px;color:#666;margin-bottom:8px;border-bottom:1px solid #f2f2f2;">' +
        '<b style="font-size:14px;">&#x1F525; 热门搜索</b><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">' +
        hotWords.map(function (w) { return '<span class="tag" data-hot="' + w + '" style="cursor:pointer;padding:4px 12px;">' + w + '</span>'; }).join('') +
        '</div></div>') +
      '<div class="feed" id="search-feed">' + feedHtml(list) + '</div>' +
      (list.length ? '<div style="text-align:center;color:#bbb;font-size:12px;padding:8px;">共 ' + list.length + ' 件宝贝</div>' : '') +
      '<div class="copyright">平台免费服务 · 由 <span class="cp-brand">阿鲸渡喃</span> 出品</div>';

    $('#search-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { state.searchKeyword = $('#search-input').value; render(); }
    });
    $('#search-go').addEventListener('click', function () {
      state.searchKeyword = $('#search-input').value; render();
    });
    $all('.filter-bar .f', main).forEach(function (f) {
      f.addEventListener('click', function () {
        if (f.hasAttribute('data-cat')) state.searchCategory = f.getAttribute('data-cat');
        if (f.hasAttribute('data-sort')) state.searchSort = f.getAttribute('data-sort');
        render();
      });
    });
    $all('[data-hot]', main).forEach(function (t) {
      t.addEventListener('click', function () { state.searchKeyword = t.getAttribute('data-hot'); render(); });
    });
    bindZoneBar(main);
    bindFeedClicks(main);
  }

  // ================= 商品详情 =================
  function renderProduct(main) {
    var p = D.findById('products', state.productId);
    if (!p) { main.innerHTML = '<div class="empty">商品不存在或已下架</div><div class="copyright">平台免费服务 · 由 <span class="cp-brand">阿鲸渡喃</span> 出品</div>'; return; }
    D.incView(p.id);
    p = D.findById('products', state.productId);
    var s = sellerOf(p);
    var u = currentUser();
    var dist = prodDist(p);
    var off = p.originalPrice > p.price;
    var wanted = prodWanted(p);
    var isMine = u && p.sellerId === u.id;

    // 留言问答
    var comments = p.comments || [];
    // 交易评价（仅展示买家对卖家的评价）
    var reviews = D.reviewsOfProduct(p.id).filter(function (r) { return r.role === 'toSeller'; });
    var starStr = function (n) {
      var s = '';
      for (var i = 1; i <= 5; i++) s += i <= n ? '&#x2605;' : '&#x2606;';
      return s;
    };
    main.innerHTML =
      '<div style="position:sticky;top:0;z-index:50;background:#fff;padding:10px 6px;display:flex;align-items:center;gap:8px;">' +
        '<a href="#/home" style="font-size:22px;padding:0 8px;">&#x2190;</a>' +
        '<span style="flex:1;text-align:center;font-size:15px;font-weight:600;">宝贝详情</span>' +
        (u && !isMine ? '<span id="btn-report" style="font-size:13px;color:#999;padding:0 6px;cursor:pointer;">&#x26A0;&#xFE0F; 举报</span>' : '') +
        '<a href="#/search" style="font-size:16px;padding:0 8px;">&#x1F50D;</a>' +
      '</div>' +
      '<div class="detail-imgs">' +
        p.images.map(function (im, i) { return '<div class="img"><img' + (i > 0 ? ' loading="lazy"' : '') + ' src="' + im + '" alt="' + esc(p.title) + '"></div>'; }).join('') +
      '</div>' +
      '<div class="detail-card">' +
        '<div class="detail-price-row">' +
          '<span class="detail-price">¥' + money(p.price) + '</span>' +
          (off ? '<span class="ori-price">¥' + money(p.originalPrice) + '</span><span class="tag" style="background:#FFEBEE;color:#c62828;align-self:center;">已降' + Math.round((1 - p.price / p.originalPrice) * 100) + '%</span>' : '') +
        '</div>' +
        '<div class="fee-note" style="background:#EAF7E8;color:#2b7a22;border-radius:6px;padding:8px 10px;font-size:12px;margin-top:8px;">&#x2705; 平台免费服务 · 线下现场成交：请与卖家当面验货、当面结算，平台不参与收款，不收取任何服务费。</div>' +
        '<div class="detail-title">' + esc(p.title) + '</div>' +
        '<div class="detail-row">' +
          '<span class="tag">' + esc(p.category) + '</span>' +
          '<span class="tag">' + esc(p.condition) + '</span>' +
          (p.brand ? '<span class="tag">' + esc(p.brand) + '</span>' : '') +
          (p.swap ? '<span class="tag green">可物物交换</span>' : '') +
        '</div>' +
'<div class="detail-row" style="margin-top:8px;color:#666;">' +
          '<span>&#x1F4CD; ' + esc(p.location.city + '·' + p.location.district + '·' + p.location.street + (p.location.community ? '·' + p.location.community : '')) + '</span>' +
          '<span class="dist" style="background:#F3F4F6;border-radius:4px;padding:2px 8px;">距您 ' + fmtDist(dist) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="detail-sec">' +
        '<h3>宝贝描述</h3>' +
        '<div class="desc-text">' + esc(p.desc || '') + '</div>' +
        '<div style="margin-top:10px;font-size:12px;color:#999;">&#x1F4E2; ' + (p.views || 0) + ' 次浏览 · ' + (p.wants ? p.wants.length : 0) + ' 人想要 · ' + D.fmtTime(p.createdAt) + ' 发布</div>' +
      '</div>' +
      '<div class="detail-sec">' +
        '<h3>卖家</h3>' +
        '<div class="seller-card">' +
          '<div class="avatar">' + (s ? (s.avatar || '&#x1F469;') : '&#x1F469;') + '</div>' +
          '<div class="seller-info">' +
            '<div class="name">' + esc(s ? s.nickname : '已注销') + (s && D.isAdminUser(s) ? ' <span style="font-size:11px;color:#d4a017;">[官方]</span>' : '') + '</div>' +
            '<div class="meta">信用 ' + (s ? s.credit : '-') + ' · ' + (s ? s.bio || '' : '') + '</div>' +
            '<div class="meta">' + (s ? esc(s.location.city + '·' + s.location.street + (s.location.community ? '·' + s.location.community : '')) : '') + '</div>' +
          '</div>' +
          (s && u && s.id !== u.id ? '<button class="btn-chat" id="btn-chat">&#x1F4AC; 聊一聊</button>' : '') +
        '</div>' +
      '</div>' +
      (reviews.length ? '<div class="detail-sec"><h3>交易评价 (' + reviews.length + ')</h3>' +
        reviews.slice(-10).reverse().map(function (r) {
          var cu = D.findById('users', r.buyerId);
          return '<div class="comment-item"><div class="who"><span class="avatar">' + (cu ? cu.avatar : '&#x1F469;') + '</span>' +
            esc(cu ? cu.nickname : '已注销用户') + ' <span style="color:#FFB400;letter-spacing:2px;">' + starStr(r.rating) + '</span>' +
            '<span style="font-weight:400;font-size:11px;color:#bbb;">' + D.fmtTime(r.time) + '</span></div>' +
            (r.content ? '<div class="txt">' + esc(r.content) + '</div>' : '') +
          '</div>';
        }).join('') + '</div>' : '') +
      (comments.length ? '<div class="detail-sec"><h3>留言问答 (' + comments.length + ')</h3>' +
        comments.map(function (c) {
          var cu = D.findById('users', c.userId);
          var creator = (u && u.id === c.userId);
          return '<div class="comment-item"><div class="who"><span class="avatar">' + (cu ? cu.avatar : '&#x1F469;') + '</span>' +
            esc(cu ? cu.nickname : '用户') + '<span style="font-weight:400;font-size:11px;color:#bbb;">' + D.fmtTime(c.time) + '</span></div>' +
            '<div class="txt">' + esc(c.content) + '</div>' +
            (c.reply ? '<div class="reply">卖家回复：' + esc(c.reply) + '</div>' : '') +
            (isMine && !c.reply ? '<button class="btn-mini warn" data-reply="' + c.id + '">回复</button>' : '') +
          '</div>';
        }).join('') + '</div>' : '') +
      '<div class="detail-sec"><h3>留言提问</h3>' +
        '<div class="comment-input">' +
          '<input id="comment-text" type="text" placeholder="问问卖家：成色、尺码、能否便宜…" ' + (u ? '' : 'disabled style="background:#f5f5f5;"') + '>' +
          '<button class="btn-mini ok" id="comment-send" ' + (u ? '' : 'disabled') + '>发送</button>' +
        '</div>' +
        (u ? '' : '<div style="font-size:12px;color:#999;margin-top:6px;">请先 <a href="#/login" style="color:#FF8C00;">登录</a> 后留言</div>') +
      '</div>' +
      '<div style="height:60px;"></div>' +
      '<div class="buy-bar">' +
        '<div class="wish" id="btn-wish"><i>' + (wanted ? '&#x2764;&#xFE0F;' : '&#x2661;') + '</i>' + (wanted ? '已想要' : '我想要') + '</div>' +
        (s && u && s.id !== u.id ? '<button class="btn-chat2" id="btn-chat2">&#x1F4AC; 聊一聊</button>' : '') +
        (isMine ?
          '<div style="flex:1;text-align:center;color:#999;font-size:13px;">' + (p.status === 'sold' ? '该宝贝已售出' : (p.status === 'locked' ? '该宝贝已被申请' : '这是您发布的宝贝')) + '</div>' :
          (p.status === 'sold'
            ? '<div class="btn-buy" id="btn-sold" style="background:#c8c8c8;color:#fff;">&#x2714; 已售出</div>'
            : (p.status === 'locked'
              ? '<div class="btn-buy" id="btn-locked" style="background:#FFE0B2;color:#8a5a00;">&#x23F3; 已被申请</div>'
              : '<div class="btn-buy" id="btn-buy">' + (p.swap ? '&#x2194; 我想要 / 交换' : '&#x1F6D2; 申请购买') + '</div>'))) +
      '</div>';

    // 事件
    if ($('#btn-chat')) $('#btn-chat').addEventListener('click', function () { openChat(p.id, s.id); });
    if ($('#btn-chat2')) $('#btn-chat2').addEventListener('click', function () { openChat(p.id, s.id); });
    if ($('#btn-report')) $('#btn-report').addEventListener('click', function () {
      var cu = requireLogin(); if (!cu) return;
      showReportModal(p);
    });
    $('#btn-wish').addEventListener('click', function () {
      var cu = requireLogin(); if (!cu) return;
      D.cloud.toggleFavorite(p.id).then(function () {
        return D.cloud.bootstrap();
      }).then(function (b) {
        if (b && b.data) D.mergeRemote(b.data);
        render();
      }).catch(function (e) { toast(e.message); });
    });
    // 留言发送（走云端 API）
    $('#comment-send').addEventListener('click', function () {
      var cu = requireLogin(); if (!cu) return;
      var txt = $('#comment-text').value.trim();
      if (!txt) { toast('请输入留言内容'); return; }
      D.cloud.comment(p.id, txt).then(function (j) {
        if (j.data) D.mergeProduct(j.data);
        toast('留言成功'); render();
      }).catch(function (e) { toast(e.message); });
    });
    $all('[data-reply]', main).forEach(function (b) {
      b.addEventListener('click', function () {
        var cid = b.getAttribute('data-reply');
        var rep = prompt('回复留言：');
        if (rep) {
          D.cloud.replyComment(p.id, cid, rep).then(function (j) {
            if (j.data) D.mergeProduct(j.data);
            render();
          }).catch(function (e) { toast(e.message); });
        }
      });
    });
    if ($('#btn-buy')) $('#btn-buy').addEventListener('click', function () { startBuy(p); });
  }

  // 打开/创建会话（在线聊一聊，会话创建走云端 API）
  function openChat(productId, sellerId) {
    var u = requireLogin(); if (!u) return;
    D.cloud.createChat(productId || null, sellerId || 'u_admin').then(function (j) {
      if (!j.data) { toast('创建会话失败，请重试'); return; }
      D.mergeChat(j.data);
      state.chatId = j.data.id;
      state.view = 'chat';
      location.hash = '#/chat/' + j.data.id;
      render();
    }).catch(function (e) { toast(e.message); });
  }

  // ---------- 分区条绑定 ----------
  function bindZoneBar(root) {
    $all('.zone-chip', root).forEach(function (c) {
      c.addEventListener('click', function () {
        state.searchZone = c.getAttribute('data-zone');
        render();
      });
    });
  }
  function bindFeedClicks(root) {
    $all('.prod-card', root).forEach(function (card) {
      card.addEventListener('click', function () {
        state.productId = card.getAttribute('data-pid');
        state.view = 'product';
        location.hash = '#/product/' + state.productId;
      });
    });
  }

  // ================= 发布 =================
  function renderPublish(main) {
    var u = requireLogin();
    if (!u) { main.innerHTML = '<div class="empty">请先登录</div>'; return; }
    if (!D.isVerified(u)) {
      main.innerHTML =
        '<div style="position:sticky;top:0;z-index:50;background:#fff;padding:10px 6px;display:flex;align-items:center;">' +
          '<a href="#/home" style="font-size:22px;padding:0 8px;">&#x2190;</a>' +
          '<span style="flex:1;text-align:center;font-size:15px;font-weight:600;">发布宝贝</span>' +
          '<span style="width:40px;"></span>' +
        '</div>' +
        '<div class="empty" style="padding:60px 24px;">' +
          '<div style="font-size:44px;margin-bottom:12px;">&#x1F512;</div>' +
          '<div style="font-weight:600;font-size:16px;margin-bottom:8px;">发布宝贝前需完成实名认证</div>' +
          '<div style="font-size:13px;color:#999;line-height:1.7;">依据平台《实名认证协议》，为保障交易安全，发布商品前须完成平台实名认证。认证信息仅用于身份核验，证件号脱敏存储、不对外展示。</div>' +
          '<button class="btn-primary" id="gate-verify" style="margin-top:18px;">去实名认证</button>' +
        '</div>';
      $('#gate-verify').addEventListener('click', function () {
        requireVerified(u, function () { render(); });
      });
      return;
    }
    var loc = u.location || G.defaultLocation();
    main.innerHTML =
      '<div style="position:sticky;top:0;z-index:50;background:#fff;padding:10px 6px;display:flex;align-items:center;">' +
        '<a href="#/home" style="font-size:22px;padding:0 8px;">&#x2190;</a>' +
        '<span style="flex:1;text-align:center;font-size:15px;font-weight:600;">发布宝贝</span>' +
        '<span style="width:40px;"></span>' +
      '</div>' +
      '<div class="form-card">' +
        '<div class="form-row"><label>分类</label><select id="pb-cat">' +
          CATS.map(function (c) { return '<option value="' + c + '"' + (state.publishCategory === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="form-row"><label>商品图片</label><div style="flex:1;">' +
          '<div class="upload-grid" id="pb-images"></div>' +
          '<div style="font-size:11px;color:#999;">可点选插图或上传本地实拍图（自动压缩）</div>' +
        '</div></div>' +
        '<div class="form-row"><label>标题</label><input type="text" id="pb-title" maxlength="40" placeholder="品牌+品类+尺码，例如：巴拉巴拉 儿童羽绒服 90码"></div>' +
        '<div class="form-row"><label>品牌</label><input type="text" id="pb-brand" placeholder="如：巴拉巴拉 / 乐高 / 伟易达"></div>' +
        '<div class="form-row"><label>成色</label><select id="pb-condition">' +
          CONDITIONS.map(function (c) { return '<option>' + c + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="form-row"><label>现价(¥)</label><input type="number" id="pb-price" min="0.01" step="0.01" placeholder="0.00"></div>' +
        '<div class="fee-split" id="pb-fee-split" style="background:#EAF7E8;color:#2b7a22;border-radius:6px;">&#x2705; 平台免费服务：发布、成交均不收取任何服务费。买家与卖家线下现场交易，当面验货、当面结算。</div>' +
        '<div class="form-row"><label>原价(¥)</label><input type="number" id="pb-ori" min="0" step="0.01" placeholder="折价销售可填写"><div style="font-size:11px;color:#999;font-weight:400;">折价标签自动生成</div></div>' +
        '<div class="form-row"><label>可交换</label><select id="pb-swap"><option value="0">仅出售</option><option value="1">支持物物交换</option></select><div style="font-size:11px;color:#999;">周边3km交换更划算</div></div>' +
        '<div class="form-row"><label>所在地</label><div style="flex:1;">' + buildLocSelects(loc) + '</div></div>' +
        '<div class="form-row"><label>描述</label><textarea id="pb-desc" placeholder="成色细节、购买时间、转让原因…"></textarea></div>' +
        '<button class="btn-primary" id="pb-submit">发 布</button>' +
      '</div>' +
      '<div class="copyright">发布免费 · 平台不收取服务费 · 由 <span class="cp-brand">阿鲸渡喃</span> 出品</div>';

    // 图片选择
    var imgGrid = $('#pb-images');
    function renderImages() {
      imgGrid.innerHTML = state.publishImages.map(function (im, i) {
        return '<div class="upload-cell"><img src="' + im + '" alt=""><span class="del" data-idx="' + i + '">&#x2715;</span></div>';
      }).join('') +
      (state.publishImages.length < 6 ? '<label class="upload-cell" style="color:#bbb;font-size:11px;flex-direction:column;">&#x2B; 上传</label>' + '<label class="upload-cell" style="color:#bbb;font-size:11px;flex-direction:column;">&#x1F5BC;&#xFE0F; 插图</label>' : '');
      $all('.upload-cell .del', imgGrid).forEach(function (d) {
        d.addEventListener('click', function (e) {
          e.preventDefault();
          state.publishImages.splice(Number(d.getAttribute('data-idx')), 1);
          renderImages();
        });
      });
      var labels = $all('.upload-cell', imgGrid);
      if (labels.length) {
        labels[labels.length - 1].addEventListener('click', function (e) { e.preventDefault(); pickSampleImage(); });
        if (state.publishImages.length < 6) {
          labels[labels.length - 2].addEventListener('click', function (e) { e.preventDefault(); pickFileImage(); });
        }
      }
    }
    function pickSampleImage() {
      var html = '<div class="modal-mask"><div class="modal"><h3>选择插图 <span class="m-close" id="m-close">&#x2715;</span></h3>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">' +
        EMOJIS.map(function (emo, i) {
          var im = D.svgImage(emo, COLORS[i % COLORS.length], COLORS[(i + 3) % COLORS.length], '插图');
          return '<div style="background:#f6f6f6;border-radius:8px;overflow:hidden;cursor:pointer;" class="sample-img" data-im="' + i + '"><img src="' + im + '" style="width:100%;aspect-ratio:1/1;object-fit:cover;"></div>';
        }).join('') +
        '</div></div></div>';
      var mask = el(html);
      $('#modal-root').appendChild(mask);
      $('#m-close').addEventListener('click', function () { mask.remove(); });
      $all('.sample-img', mask).forEach(function (s) {
        s.addEventListener('click', function () {
          var i = Number(s.getAttribute('data-im'));
          state.publishImages.push(D.svgImage(EMOJIS[i], COLORS[i % COLORS.length], COLORS[(i + 3) % COLORS.length], '插图'));
          mask.remove(); renderImages();
        });
      });
    }
    function pickFileImage() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            // 压缩到 480px 内
            var ratio = Math.min(1, 480 / Math.max(img.width, img.height));
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * ratio);
            canvas.height = Math.round(img.height * ratio);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            state.publishImages.push(canvas.toDataURL('image/jpeg', 0.8));
            renderImages();
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
      input.click();
    }
renderImages();
    // 所在地三级联动（城市 → 区（县） → 街道）
    bindLocSelects(main, loc);

    // 平台免费服务说明，无需预估服务费/实得金额

    $('#pb-submit').addEventListener('click', function () {
      var title = $('#pb-title').value.trim();
      if (!title) { toast('请填写标题'); return; }
      var price = parseFloat($('#pb-price').value);
      if (!(price > 0)) { toast('请填写正确价格'); return; }
      var ori = parseFloat($('#pb-ori').value) || price;
      var imgList = state.publishImages.length ? state.publishImages : [D.svgImage('&#x1F9F0;', '#E4F6E8', '#C8EED2', '插图')];
      var payload = {
        category: $('#pb-cat').value,
        title: title, brand: $('#pb-brand').value.trim(), condition: $('#pb-condition').value,
        price: price, originalPrice: Math.max(price, ori), swap: $('#pb-swap').value === '1',
        images: imgList, location: (function () { var s = readLocSelects(main); return (s && s.city && s.district && s.street) ? G.findPlace(s.city, s.district, s.street, s.community) : (u.location || G.defaultLocation()); })(), tags: [],
        desc: $('#pb-desc').value.trim()
      };
      var btn = $('#pb-submit');
      btn.disabled = true; btn.textContent = '发布中…';
      D.cloud.createProduct(payload).then(function (j) {
        if (j.data) D.mergeProduct(j.data);
        btn.disabled = false; btn.textContent = '发 布';
        toast('发布成功！');
        state.publishImages = [];
        state.view = 'profile';
        state.profileTab = 'publish';
        location.hash = '#/profile';
        render();
      }).catch(function (e) { btn.disabled = false; btn.textContent = '发 布'; toast(e.message); });
    });
  }

  // ================= 消息 / 聊一聊 =================
  function unreadCount(userId) {
    var db = D.DB();
    var n = 0;
    (db.chats || []).forEach(function (c) {
      var meIsSeller = c.sellerId === userId;
      var meIsBuyer = c.buyerId === userId;
      if (!meIsSeller && !meIsBuyer) return;
      (c.messages || []).forEach(function (m) {
        if (m.from !== userId && !m.read) n++;
      });
    });
    (db.feeds || []).forEach(function (f) {
      if (f.userId === userId && f.reply && !f.replyRead) n++;
    });
    return n;
  }

  function otherUserOfChat(c, me) {
    return D.findById('users', c.sellerId === me.id ? c.buyerId : c.sellerId) ||
           D.findById('users', c.sellerId) || { nickname: '对方', avatar: '&#x1F469;' };
  }
  function productOfChat(c) {
    return c.productId ? D.findById('products', c.productId) : null;
  }

  function renderMessages(main) {
    var u = requireLogin();
    if (!u) { main.innerHTML = '<div class="empty">请先登录</div>'; render(); return; }
    var db = D.DB();
    var chats = (db.chats || []).filter(function (c) {
      return c.sellerId === u.id || c.buyerId === u.id;
    }).sort(function (a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });

    main.innerHTML =
      '<div class="topbar" style="background:#fff;border-bottom:1px solid #eee;">' +
        '<span style="font-size:17px;font-weight:700;">消息</span>' +
        '<span style="font-size:12px;color:#999;margin-left:8px;">&#x1F4AC; 在线聊一聊，同城见面交易更放心</span>' +
      '</div>' +
      '<div class="sec-head" style="padding:8px 14px 4px;"><b>会话 (' + chats.length + ')</b></div>' +
      (chats.length ? chats.map(function (c) {
        var other = otherUserOfChat(c, u);
        var prod = productOfChat(c);
        var last = c.messages[c.messages.length - 1];
        var unread = c.messages.filter(function (m) { return m.from !== u.id && !m.read; }).length;
        var p = prod ? '「' + prod.title.slice(0, 10) + '」' : '平台';
        return '<a class="conv-item" href="#/chat/' + c.id + '">' +
          '<div class="avatar">' + (other.avatar || '&#x1F469;') + '</div>' +
          '<div class="info"><div class="top"><span>' + esc(other.nickname) + ' <span style="font-weight:400;font-size:11px;color:#999;">与' + p + '</span></span><span class="time">' + D.fmtTime(c.updatedAt) + '</span></div>' +
          '<div class="last">' + (last ? esc(last.text) : '打个招呼吧') + '</div></div>' +
          (unread ? '<span class="badge">' + unread + '</span>' : '') +
        '</a>';
      }).join('') : '<div class="empty">还没有会话，去逛逛宝贝，和卖家聊聊吧</div>') +

      // 咨询客服
      '<div class="sec-head" style="padding:14px 14px 4px;"><b>客服中心</b></div>' +
      '<a class="conv-item" href="javascript:;" id="cs-link">' +
        '<div class="avatar" style="background:#FFF6C2;">&#x1F4E2;</div>' +
        '<div class="info"><div class="top"><span>邻居好物客服</span></div>' +
        '<div class="last">客服邮箱 ' + esc(D.DEFAULT_SETTINGS.customerEmail) + '，也可在线咨询</div></div>' +
      '</a>' +
      '<div class="copyright">平台免费服务 · 由 <span class="cp-brand">阿鲸渡喃</span> 出品</div>';
    $('#cs-link').addEventListener('click', function () { openChat(null, 'u_admin'); });
  }

  function renderChat(main) {
    var u = requireLogin();
    if (!u) { main.innerHTML = '<div class="empty">请先登录</div>'; return; }
    var db = D.DB();
    var cid = state.chatId;
    if (cid === 'platform' || cid == null) { openChat(null, 'u_admin'); return; }
    var chat = db.chats.find(function (c) { return c.id === cid; });
    if (!chat) { main.innerHTML = '<div class="empty">会话不存在</div>'; return; }

    var other = otherUserOfChat(chat, u);
    var prod = productOfChat(chat);

    main.innerHTML =
      '<div class="chat-page">' +
        '<div class="chat-head">' +
          '<a href="javascript:;" style="font-size:20px;" id="chat-back">&#x2190;</a>' +
          '<span>' + esc(other.nickname) + '</span>' +
          (prod ? '<span style="font-size:12px;color:#888;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"> ' + esc(prod.title) + '</span>' : '') +
        '</div>' +
        '<div class="chat-body" id="chat-body">' +
          chat.messages.map(function (m) {
            var mine = m.from === u.id;
            var sender = D.findById('users', m.from);
            return '<div class="msg ' + (mine ? 'mine' : 'theirs') + '">' +
              (mine ? '' : '<div class="avatar" style="width:30px;height:30px;font-size:14px;">' + ((sender && sender.avatar) || '&#x1F469;') + '</div>') +
              '<div>' +
                '<div class="bubble">' + esc(m.text) + (m.offer ? '<div style="color:#d4a017;margin-top:4px;font-size:12px;">出价 ¥' + money(m.offer) + '</div>' : '') + '</div>' +
                '<div class="time">' + D.fmtTime(m.time) + '</div>' +
              '</div></div>';
          }).join('') +
        '</div>' +
        '<div class="chat-input">' +
          '<span class="quick" data-q="在吗？">&#x1F64B;</span>' +
          '<input id="chat-text" type="text" placeholder="按回车发送…">' +
          '<button id="chat-send">发送</button>' +
        '</div>' +
      '</div>';

    // 标记已读
    chat.messages.forEach(function (m) { if (m.from !== u.id) m.read = true; });
    D.save();

    function sendMsg(text) {
      if (!text.trim()) return;
      D.cloud.sendMessage(chat.id, text.trim()).then(function (j) {
        if (j.data) D.mergeChat(j.data);
        if (state.chatId === chat.id) renderChat(main);
        $('#chat-text').value = '';
        var body = $('#chat-body'); if (body) body.scrollTop = body.scrollHeight;
      }).catch(function (e) { toast(e.message); });
    }

    $('#chat-back').addEventListener('click', function () {
      state.view = 'messages'; location.hash = '#/messages';
    });
    $('#chat-send').addEventListener('click', function () { sendMsg($('#chat-text').value); });
    $('#chat-text').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendMsg($('#chat-text').value); });
    $all('.quick', main).forEach(function (q) {
      q.addEventListener('click', function () {
        sendMsg(q.getAttribute('data-q'));
      });
    });
    var body = $('#chat-body');
    if (body) { body.scrollTop = body.scrollHeight; body.classList.add('msg-loaded'); }
  }

  // ================= 交易 / 订单（线下现场成交：申请 → 已联系 → 完成/取消，无在线支付） =================
  // 购买入口：先实名认证，通过后弹出确认申请
  function startBuy(p) {
    var u = requireLogin(); if (!u) return;
    if (u.id === p.sellerId) { toast('不能购买自己发布的商品'); return; }
    if (!D.isVerified(u)) {
      toast('购买前请先完成实名认证');
      requireVerified(u, function () { showOrderModal(p, u); });
      return;
    }
    showOrderModal(p, u);
  }
  function showOrderModal(p, u) {
    var swap = p.swap;
    var html = '<div class="modal-mask"><div class="modal"><h3>确认申请购买 <span class="m-close" id="m-close">&#x2715;</span></h3>' +
      '<div style="border-bottom:1px solid #f2f2f2;padding-bottom:10px;margin-bottom:10px;">' +
        '<div style="font-weight:600;">' + esc(p.title) + '</div>' +
        '<div style="font-size:12px;color:#999;margin-top:4px;">卖家：' + esc(sellerOf(p).nickname) + ' · ' + esc(p.location.district + '·' + p.location.street + (p.location.community ? '·' + p.location.community : '')) + '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;color:#666;padding:4px 0;">' +
        '<span>商品价</span><span>¥' + money(p.price) + '</span></div>' +
      '<div style="background:#EAF7E8;border-radius:6px;padding:8px 10px;font-size:12px;color:#2b7a22;margin-top:8px;">' +
        '&#x2705; 平台免费服务：无服务费、无在线支付。下单后请与卖家线下当面看货、当面结算。</div>' +
      (swap ?
        '<div style="background:#EAF7E8;border-radius:6px;padding:8px 10px;font-size:12px;color:#2b7a22;margin-top:8px;">' +
          '&#x2194; 该宝贝支持物物交换：可留言与卖家协商交换物品。</div>' +
        '<div style="margin-top:8px;"><input id="go-swap-text" type="text" maxlength="60" placeholder="如想交换，请说明您想交换的物品（可选）" style="width:100%;box-sizing:border-box;border:1px solid #eee;border-radius:8px;padding:10px;font-size:13px;"></div>' : '') +
      '<button class="btn-primary" id="go-apply" style="margin-top:12px;">确认申请（线下交易）</button>' +
    '</div></div>';
    var mask = el(html);
    $('#modal-root').appendChild(mask);
    $('#m-close').addEventListener('click', function () { mask.remove(); });
    $('#go-apply').addEventListener('click', function () {
      var swapText = $('#go-swap-text') ? $('#go-swap-text').value.trim() : '';
      mask.remove();
      submitOrderApply(p, swapText);
    });
  }

  function submitOrderApply(p, swapText) {
    if (p.status !== 'on') { toast('商品已被申请，去看看其他宝贝吧'); location.hash = '#/home'; render(); return; }
    D.cloud.createOrder(p.id, swapText || '').then(function (j) {
      if (j.data) D.mergeOrder(j.data);
      return D.cloud.bootstrap();
    }).then(function (b) {
      if (b && b.data) D.mergeRemote(b.data);
      toast('申请成功！卖家将线下联系您当面交易');
      state.view = 'orders';
      state.orderTab = 'buying';
      state.orderStatus = 'new';
      location.hash = '#/orders';
      render();
    }).catch(function (e) { toast(e.message); });
  }

  function renderOrders(main) {
    var u = requireLogin();
    if (!u) { main.innerHTML = '<div class="empty">请先登录</div>'; return; }
    var db = D.DB();
    var orders = (db.orders || []).filter(function (o) {
      return state.orderTab === 'buying' ? o.buyerId === u.id : o.sellerId === u.id;
    }).filter(function (o) {
      if (state.orderStatus === 'all') return true;
      if (state.orderStatus === 'active') return o.status === 'new' || o.status === 'contacted';
      return o.status === state.orderStatus;
    }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

    var tabs = [['all', '全部'], ['new', '已申请'], ['contacted', '待交易'], ['done', '已完成'], ['canceled', '已取消']];

    var STATUS = {
      new: '已申请', contacted: '待交易', done: '已完成', canceled: '已取消'
    };
    var STATUS_COLOR = { new: '#FF8C00', contacted: '#1677FF', done: '#2b7a22', canceled: '#999' };

    main.innerHTML =
      '<div class="topbar" style="background:#fff;border-bottom:1px solid #eee;">' +
        '<span style="font-size:17px;font-weight:700;">我的订单</span>' +
        '<span style="font-size:12px;color:#999;margin-left:8px;">' + (state.orderTab === 'buying' ? '我买到的' : '我卖出的') + ' · 线下现场成交</span>' +
      '</div>' +
      '<div class="order-tabs">' +
        (state.orderTab === 'buying'
          ? '<span class="order-tab' + (true ? ' active' : '') + '" data-tab="buying">我买到的</span>' +
            '<span class="order-tab" data-tab="selling">我卖出的</span>'
          : '<span class="order-tab" data-tab="buying">我买到的</span>' +
            '<span class="order-tab' + (true ? ' active' : '') + '" data-tab="selling">我卖出的</span>') +
      '</div>' +
      '<div class="order-tabs" style="top:0;border-top:1px solid #f5f5f5;">' +
        tabs.map(function (t) {
          return '<span class="order-tab' + (state.orderStatus === t[0] ? ' active' : '') + '" data-status="' + t[0] + '">' + t[1] + '</span>';
        }).join('') +
      '</div>' +
      (orders.length ? orders.map(function (o) {
        return '<div class="order-card">' +
          '<div class="head"><span>订单号 ' + esc(o.orderNo) + '</span><span style="color:' + STATUS_COLOR[o.status] + ';">' + STATUS[o.status] + '</span></div>' +
          '<div class="item" data-prod="' + o.productId + '" style="cursor:pointer;">' +
            '<div class="thumb"><img loading="lazy" src="' + o.image + '" alt=""></div>' +
            '<div class="mid"><div class="title">' + esc(o.title) + '</div>' +
              '<div style="font-size:12px;color:#999;margin-top:4px;">售价 ¥' + money(o.price) + ' · 线下现场交易</div>' +
              (o.swapText ? '<div style="font-size:12px;color:#d4a017;margin-top:2px;">交换意向：' + esc(o.swapText) + '</div>' : '') +
              (o.history && o.history.length ? '<div style="font-size:11px;color:#bbb;margin-top:2px;">' + esc(o.history[o.history.length - 1].text) + '</div>' : '') +
            '</div>' +
          '</div>' +
          '<div class="foot">' +
            orderActions(o, u) +
          '</div>' +
        '</div>';
      }).join('') : '<div class="empty">暂无订单</div>') +
      '<div class="copyright">平台免费服务 · 无服务费 · 由 <span class="cp-brand">阿鲸渡喃</span> 出品</div>';

    $all('.order-tab', main).forEach(function (t) {
      t.addEventListener('click', function () {
        if (t.hasAttribute('data-tab')) { state.orderTab = t.getAttribute('data-tab'); state.orderStatus = 'all'; }
        if (t.hasAttribute('data-status')) state.orderStatus = t.getAttribute('data-status');
        render();
      });
    });
    $all('[data-act]', main).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var act = b.getAttribute('data-act');
        var oid = b.getAttribute('data-oid');
        orderAction(oid, act);
      });
    });
    $all('[data-prod]', main).forEach(function (it) {
      it.addEventListener('click', function () {
        location.hash = '#/product/' + it.getAttribute('data-prod');
        render();
      });
    });
  }

  function orderActions(o, u) {
    var btns = '';
    var reviewed = !!(o.reviewedBy && o.reviewedBy[u.id]);
    var meBuyer = state.orderTab === 'buying';
    if (o.status === 'new') {
      if (meBuyer) {
        btns += '<span style="font-size:12px;color:#999;margin-right:8px;">等待卖家联系</span>';
        btns += '<button class="order-btn gray" data-act="cancel" data-oid="' + o.id + '">取消申请</button>';
      } else {
        btns += '<button class="order-btn solid" data-act="contact" data-oid="' + o.id + '">已联系买家</button>';
        btns += '<button class="order-btn gray" data-act="cancel" data-oid="' + o.id + '">取消</button>';
      }
    } else if (o.status === 'contacted') {
      btns += '<button class="order-btn solid" data-act="done" data-oid="' + o.id + '">确认成交完成</button>';
      btns += '<button class="order-btn gray" data-act="cancel" data-oid="' + o.id + '">取消交易</button>';
    } else if (o.status === 'done') {
      btns += reviewed
        ? '<span style="font-size:12px;color:#999;">已评价</span>'
        : '<button class="order-btn solid" data-act="review" data-oid="' + o.id + '">评价</button>';
      btns += '<button class="order-btn gray" data-act="chat2" data-oid="' + o.id + '">' + (meBuyer ? '联系卖家' : '联系买家') + '</button>';
    }
    return btns;
  }

  function orderAction(oid, act) {
    var u = requireLogin(); if (!u) return;
    var o = D.findById('orders', oid);
    if (!o) return;
    if (act === 'review') { showReviewModal(o, u); return; }
    if (act === 'chat2') {
      var p2 = D.findById('products', o.productId);
      openChat(p2 ? p2.id : null, o.sellerId === u.id ? o.buyerId : o.sellerId);
      return;
    }
    var tip = { contact: '已确认联系买家，等待线下交易', done: '交易完成！', cancel: '申请已取消' };
    D.cloud.orderAction(oid, act).then(function (j) {
      if (j.data) D.mergeOrder(j.data);
      return D.cloud.bootstrap();
    }).then(function (b) {
      if (b && b.data) D.mergeRemote(b.data);
      toast(tip[act] || '操作成功');
      render();
    }).catch(function (e) { toast(e.message); });
  }

  // 交易评价弹窗（买家评价卖家 / 卖家评价买家，走云端 API）
  function showReviewModal(o, u) {
    var isBuyer = o.buyerId === u.id;
    var targetId = isBuyer ? o.sellerId : o.buyerId;
    var target = D.findById('users', targetId);
    var rating = 5;
    var stars = [1, 2, 3, 4, 5];
    var starRow = function (cur) {
      return stars.map(function (s) {
        return '<span class="rv-star" data-star="' + s + '" style="font-size:30px;cursor:pointer;color:#FFB400;">' + (s <= cur ? '&#x2605;' : '&#x2606;') + '</span>';
      }).join('');
    };
    var html = '<div class="modal-mask"><div class="modal"><h3>' + (isBuyer ? '评价卖家' : '评价买家') + ' <span class="m-close" id="m-close">&#x2715;</span></h3>' +
      '<div style="font-size:12px;color:#999;margin-bottom:10px;">交易对象：' + esc(target ? target.nickname : '用户') + '</div>' +
      '<div class="rv-stars" id="rv-stars">' + starRow(rating) + '</div>' +
      '<div style="font-size:12px;color:#bbb;margin:4px 0 8px;">点击星星打分（1-5 星）</div>' +
      '<textarea id="rv-text" rows="3" placeholder="说说这次交易体验（可选）" style="width:100%;box-sizing:border-box;border:1px solid #eee;border-radius:8px;padding:10px;font-size:14px;resize:none;"></textarea>' +
      '<button class="btn-primary" id="rv-submit" style="margin-top:12px;width:100%;">提交评价</button>' +
    '</div></div>';
    var mask = el(html);
    $('#modal-root').appendChild(mask);
    $('#m-close').addEventListener('click', function () { mask.remove(); });
    function paintStars(cur) {
      $('#rv-stars').innerHTML = starRow(cur);
      $all('.rv-star', mask).forEach(function (s) {
        s.addEventListener('click', function () {
          rating = parseInt(s.getAttribute('data-star'), 10);
          paintStars(rating);
        });
      });
    }
    paintStars(rating);
    $('#rv-submit').addEventListener('click', function () {
      if (!rating || rating < 1 || rating > 5) { toast('请选择星级'); return; }
      var txt = ($('#rv-text') ? $('#rv-text').value.trim() : '');
      var role = isBuyer ? 'toSeller' : 'toBuyer';
      var btn = $('#rv-submit');
      btn.disabled = true; btn.textContent = '提交中…';
      D.cloud.review(o.id, rating, txt, role).then(function () {
        return D.cloud.bootstrap();
      }).then(function (b) {
        if (b && b.data) D.mergeRemote(b.data);
        mask.remove();
        toast('评价成功，感谢您的反馈');
        render();
      }).catch(function (e) { btn.disabled = false; btn.textContent = '提交评价'; toast(e.message); });
    });
  }

  // 举报商品弹窗（走云端 API）
  function showReportModal(p) {
    var html = '<div class="modal-mask"><div class="modal"><h3>举报该宝贝 <span class="m-close" id="m-close">&#x2715;</span></h3>' +
      '<div style="font-size:12px;color:#999;margin-bottom:10px;">请选择举报原因，我们将尽快核实处理。</div>' +
      '<select id="rp-reason" style="width:100%;box-sizing:border-box;border:1px solid #eee;border-radius:8px;padding:10px;font-size:14px;margin-bottom:8px;">' +
        '<option>假冒伪劣/侵权商品</option><option>虚假描述/货不对板</option><option>违禁或违规商品</option><option>诈骗或诱导交易</option><option>骚扰或不文明行为</option><option>其他问题</option>' +
      '</select>' +
      '<textarea id="rp-desc" rows="3" placeholder="补充说明（可选）" style="width:100%;box-sizing:border-box;border:1px solid #eee;border-radius:8px;padding:10px;font-size:14px;resize:none;"></textarea>' +
      '<button class="btn-primary" id="rp-submit" style="margin-top:12px;width:100%;">提交举报</button>' +
    '</div></div>';
    var mask = el(html);
    $('#modal-root').appendChild(mask);
    $('#m-close').addEventListener('click', function () { mask.remove(); });
    $('#rp-submit').addEventListener('click', function () {
      var u = requireLogin(); if (!u) return;
      var reason = $('#rp-reason').value;
      var desc = $('#rp-desc').value.trim();
      D.cloud.createReport({
        productId: p.id, title: p.title, reason: reason,
        content: (reason + (desc ? '：' + desc : ''))
      }).then(function () {
        mask.remove();
        toast('举报已提交，平台将尽快核实处理');
        render();
      }).catch(function (e) { toast(e.message); });
    });
  }

  // ================= 我的 =================
  function renderProfile(main) {
    var u = requireLogin();
    if (!u) { main.innerHTML = '<div class="empty">请先登录</div>'; return; }
    var db = D.DB();
    var myProds = db.products.filter(function (p) { return p.sellerId === u.id; });
    var buying = db.orders.filter(function (o) { return o.buyerId === u.id; });
    var selling = db.orders.filter(function (o) { return o.sellerId === u.id; });
    var favs = db.favorites.filter(function (f) { return f.userId === u.id; });
    var chats = db.chats.filter(function (c) { return c.sellerId === u.id || c.buyerId === u.id; });

    var tab = state.profileTab;
    var panel = '';
    if (tab === 'publish') {
      var rows = myProds.map(function (p) {
        var off = p.originalPrice > p.price;
        return '<div class="order-card">' +
          '<div class="item"><div class="thumb"><img loading="lazy" src="' + p.images[0] + '" alt=""></div>' +
          '<div class="mid"><div class="title">' + esc(p.title) + '</div>' +
          '<div style="font-size:12px;color:#999;margin-top:4px;">' + esc(p.category) + ' · ' + esc(p.condition) + ' · ' + D.fmtTime(p.createdAt) + '</div>' +
          '<div style="color:#FF4C29;font-weight:700;margin-top:4px;">¥' + money(p.price) + (off ? ' <span style="text-decoration:line-through;font-size:11px;color:#bbb;">¥' + money(p.originalPrice) + '</span>' : '') + '</div>' +
          '<div style="font-size:11px;color:#999;margin-top:2px;">' + (p.views || 0) + ' 浏览 · ' + (p.wants ? p.wants.length : 0) + ' 想要 · ' + (p.status === 'on' ? '<span style="color:#2b7a22;">在售</span>' : p.status === 'sold' ? '已售' : p.status === 'locked' ? '<span style="color:#d4a017;">已被申请</span>' : '下架') + '</div></div></div>' +
          '<div class="foot">' +
            '<a class="order-btn gray" href="#/product/' + p.id + '">查看</a>' +
            (p.status === 'on' ? '<button class="order-btn gray" data-pact="down" data-pid="' + p.id + '">下架</button>' : '<button class="order-btn solid" data-pact="up" data-pid="' + p.id + '">上架</button>') +
            '<button class="order-btn gray" data-pact="del" data-pid="' + p.id + '">删除</button>' +
          '</div></div>';
      }).join('');
      panel = '<div class="sec-head" style="padding-bottom:4px;"><b>我发布的 (' + myProds.length + ')</b><a href="#/publish" style="color:#FF8C00;font-size:13px;">+ 发布宝贝</a></div>' +
        (rows || '<div class="empty">还没有发布商品</div>') +
        '<div class="sec-head" style="padding-bottom:4px;"><b>我想要的 (' + favs.length + ')</b></div>' +
        (favs.length ? '<div class="feed cols-1">' + favs.map(function (f) {
          var p = D.findById('products', f.productId);
          return p ? prodCardHtml(p) : '';
        }).join('') + '</div>' : '<div class="empty">还没有想要的宝贝</div>');
      bindProfileProductActions(main);
      bindFeedClicks(main);
    } else if (tab === 'orders') {
      panel = '<a href="#/orders" style="display:block;"><div class="stat-row">' +
        '<div class="st"><b>' + buying.length + '</b><span>我买到的</span></div>' +
        '<div class="st"><b>' + selling.length + '</b><span>我卖出的</span></div>' +
        '<div class="st"><b>' + selling.filter(function (o) { return o.status === 'new' || o.status === 'contacted'; }).length + '</b><span>进行中</span></div>' +
        '<div class="st"><b>' + buying.filter(function (o) { return o.status === 'done'; }).length + '</b><span>已完成</span></div>' +
      '</div></a>';
    } else if (tab === 'location') {
      // 修改我的位置（走云端 API）
      var html = '<div class="form-card"><div class="form-row"><label style="width:auto;">我的位置</label></div>';
      html += buildLocSelects(u.location);
      html += '<button class="btn-primary" id="save-loc">保存位置</button>';
      html += '<div style="font-size:12px;color:#999;margin-top:10px;">保存后，首页和搜索将按同城市/同区域/同街道筛选并显示距离，默认优先展示 3 千米内宝贝。</div></div>';
panel = html;
    }

    var unread = 0;
    chats.forEach(function (c) {
      c.messages.forEach(function (m) { if (m.from !== u.id && !m.read) unread++; });
    });

    main.innerHTML =
      '<div class="topbar" style="background:linear-gradient(135deg,#FFE001,#FFC700);border-bottom:none;">' +
        '<span style="font-size:17px;font-weight:700;">我的</span>' +
        '<a href="#/search" style="font-size:16px;margin-left:auto;">&#x2699;&#xFE0F;</a>' +
      '</div>' +
      '<div class="profile-head">' +
        '<div class="avatar">' + (u.avatar || '&#x1F469;') + '</div>' +
        '<div>' +
          '<div class="name">' + esc(u.nickname) + (D.isAdminUser(u) ? ' <span style="font-size:11px;background:#FFF6C2;border-radius:4px;padding:1px 6px;color:#8a6d00;">管理员</span>' : '') + '</div>' +
          '<div class="sub">' + esc(u.phone) + ' · ' + (u.location ? esc(u.location.city + '·' + u.location.street + (u.location.community ? '·' + u.location.community : '')) : '') + '</div>' +
          '<div class="sub">信用 ' + u.credit + ' · ' + esc(u.bio || '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="stat-row">' +
        '<div class="st"><b>' + myProds.filter(function (p) { return p.status === 'on'; }).length + '</b><span>在售</span></div>' +
        '<div class="st"><b>' + favs.length + '</b><span>想要</span></div>' +
        '<div class="st"><b>' + chats.length + '</b><span>会话</span></div>' +
        '<div class="st"><b>' + buying.length + '</b><span>买到的</span></div>' +
      '</div>' +
      '<div class="menu-group">' +
        '<a class="menu-item" href="#/orders"><span class="mi-ico">&#x1F4E6;</span>我的订单<span class="mi-badge">' + unread + '</span></a>' +
      '</div>' +
      '<div class="sec-head" style="padding:14px 14px 4px;"><b>功能</b></div>' +
      '<div class="menu-group">' +
'<a class="menu-item' + (tab === 'publish' ? ' active' : '') + '" href="#/profile/publish" data-mtab="publish"><span class="mi-ico">&#x1F4E6;</span>我的发布<span class="mi-arrow">&#x203A;</span></a>' +
        '<a class="menu-item' + (tab === 'orders' ? ' active' : '') + '" href="#/profile/orders" data-mtab="orders"><span class="mi-ico">&#x1F4B3;</span>订单统计<span class="mi-arrow">&#x203A;</span></a>' +
        '<a class="menu-item' + (tab === 'location' ? ' active' : '') + '" href="#/profile/location" data-mtab="location"><span class="mi-ico">&#x1F4CD;</span>我的位置（同城筛选）<span class="mi-arrow">&#x203A;</span></a>' +
        '<a class="menu-item" href="javascript:;" id="mn-verify"><span class="mi-ico">&#x1F511;</span>实名认证<span class="mi-tag">' + (D.isVerified(u) ? '已认证' : '去认证') + '</span><span class="mi-arrow">&#x203A;</span></a>' +
        '<a class="menu-item" href="javascript:;" id="mn-pwd"><span class="mi-ico">&#x1F512;</span>修改密码<span class="mi-arrow">&#x203A;</span></a>' +
        '<a class="menu-item" href="#/messages"><span class="mi-ico">&#x1F4AC;</span>消息 / 聊一聊<span class="mi-arrow">&#x203A;</span></a>' +
        '<a class="menu-item" href="javascript:;" id="mn-cs"><span class="mi-ico">&#x1F4E2;</span>客服中心（' + esc(D.DEFAULT_SETTINGS.customerEmail) + '）<span class="mi-arrow">&#x203A;</span></a>' +
        (D.isAdminUser(u) ? '<a class="menu-item admin" href="#/admin"><span class="mi-ico">&#x1F6E1;&#xFE0F;</span>管理后台（最高权限）<span class="mi-arrow">&#x203A;</span></a>' : '') +
        '<a class="menu-item" href="javascript:;" id="mn-about"><span class="mi-ico">&#x2139;&#xFE0F;</span>关于邻居好物<span class="mi-arrow">&#x203A;</span></a>' +
      '</div>' +
      '<div style="padding:12px 14px 0;">' + panel + '</div>' +
      '<div class="copyright">平台免费服务 · 由 <span class="cp-brand">阿鲸渡喃</span> 出品<br>© ' + new Date().getFullYear() + ' 邻居好物</div>';
    window.scrollTo(0, 0);

    if (tab === 'location') {
      bindLocSelects(main, u.location || G.defaultLocation());
      $('#save-loc').addEventListener('click', function () {
        var sel = readLocSelects(main);
        if (!sel.city || !sel.district || !sel.street) { toast('请选择完整位置'); return; }
        var loc = G.findPlace(sel.city, sel.district, sel.street, sel.community);
        D.cloud.updateLocation(loc).then(function (j) {
          if (j.data && j.data.user) D.mergeUser(j.data.user);
          toast('位置已更新');
          state.profileTab = 'location';
          renderProfile(main);
        }).catch(function (e) { toast(e.message); });
      });
    }

    $all('[data-mtab]', main).forEach(function (m) {
      m.addEventListener('click', function () {
        var t = m.getAttribute('data-mtab');
        if (location.hash === '#/profile/' + t) {
          state.profileTab = t;
          renderProfile(main);
          window.scrollTo(0, 0);
        }
      });
    });
    $('#mn-cs').addEventListener('click', function () {
      openChat(null, 'u_admin');
    });
    $('#mn-verify').addEventListener('click', function () {
      requireVerified(u, function () { render(); });
    });
    $('#mn-pwd').addEventListener('click', function () {
      showChangePwd(u);
    });
    $('#mn-about').addEventListener('click', function () {
      var s = db.settings || D.DEFAULT_SETTINGS;
      alertBox('关于邻居好物', s.about + '\n\n版权：' + s.copyright);
    });
    if (tab === 'publish') { bindProfileProductActions(main); bindFeedClicks(main); }
    else if (tab === 'orders') { /* stat row is link */ }
  }

  function bindProfileProductActions(root) {
    $all('[data-pact]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-pact');
        var pid = b.getAttribute('data-pid');
        var p = D.findById('products', pid);
        if (!p) return;
        if (act === 'down' || act === 'up') {
          D.cloud.updateProduct(pid, { status: act === 'down' ? 'off' : 'on' }).then(function (j) {
            if (j.data) D.mergeProduct(j.data);
            toast(act === 'down' ? '已下架' : '已重新上架'); render();
          }).catch(function (e) { toast(e.message); });
        } else if (act === 'del') {
          if (confirm('确定删除该商品吗？')) {
            D.cloud.deleteProduct(pid).then(function () {
              D.removeItem('products', pid);
              toast('已删除'); render();
            }).catch(function (e) { toast(e.message); });
          }
        }
      });
    });
  }

// 位置选择控件（城市 -> 区县 -> 街道 -> 所在小区 四级联动）
  function buildLocSelects(cur) {
    var html = '<select class="loc-sel" id="loc-city" style="border:1px solid #EBEBEB;border-radius:6px;height:36px;padding:0 10px;margin-right:8px;">';
    G.LOCATIONS.forEach(function (c) {
      html += '<option value="' + c.city + '"' + (cur && cur.city === c.city ? ' selected' : '') + '>' + c.city + '</option>';
    });
    html += '</select><select class="loc-sel" id="loc-district"></select><select class="loc-sel" id="loc-street"></select>' +
      '<select class="loc-sel" id="loc-community" style="border:1px solid #EBEBEB;border-radius:6px;height:36px;padding:0 10px;margin-right:8px;"></select>';
    return '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">' + html + '</div>';
  }
  function bindLocSelects(root, cur) {
    function fill(city, district, street) {
      var cityObj = null;
      G.LOCATIONS.forEach(function (c) { if (c.city === city) cityObj = c; });
      var distSel = $('#loc-district');
      var dists = cityObj ? cityObj.districts : [];
      distSel.innerHTML = dists.map(function (d) {
        return '<option value="' + d.district + '"' + (cur && cur.district === d.district && city === cur.city ? ' selected' : '') + '>' + d.district + '</option>';
      }).join('');
      // 确定当前区县：显式参数优先，其次匹配当前用户位置，最后默认第一个区县
      var dName = district || (cur && cur.city === city ? cur.district : null) || (dists[0] ? dists[0].district : null);
      if (dists.length && dName) distSel.value = dName;
      var dObj = null;
      if (cityObj && dName) cityObj.districts.forEach(function (d) { if (d.district === dName) dObj = d; });
      var stSel = $('#loc-street');
      var streets = dObj ? dObj.streets : [];
      stSel.innerHTML = streets.map(function (s) {
        return '<option value="' + s.street + '"' + (cur && cur.street === s.street && cur.district === dName && cur.city === city ? ' selected' : '') + '>' + s.street + '</option>';
      }).join('');
      // 确定当前街道：显式参数优先，其次匹配当前用户位置，最后默认第一个街道
      var sName = street || (cur && cur.city === city && cur.district === dName ? cur.street : null) || (streets[0] ? streets[0].street : null);
      if (streets.length && sName) stSel.value = sName;
      var stObj = null;
      if (dObj && sName) dObj.streets.forEach(function (s) { if (s.street === sName) stObj = s; });
      var cmSel = $('#loc-community');
      var cms = stObj && stObj.communities ? stObj.communities : [];
      cmSel.innerHTML = cms.map(function (cm) {
        return '<option value="' + cm + '"' + (cur && cur.community === cm && cur.street === sName && cur.district === dName && cur.city === city ? ' selected' : '') + '>' + cm + '</option>';
      }).join('');
      var cmName = (cur && cur.city === city && cur.district === dName && cur.street === sName && cur.community) || (cms[0] ? cms[0] : null);
      if (cms.length && cmName) cmSel.value = cmName;
    }
    $('#loc-city').addEventListener('change', function () {
      fill($('#loc-city').value, null, null);
    });
    $('#loc-district').addEventListener('change', function () {
      fill($('#loc-city').value, $('#loc-district').value, null);
    });
    $('#loc-street').addEventListener('change', function () {
      fill($('#loc-city').value, $('#loc-district').value, $('#loc-street').value);
    });
    fill(cur ? cur.city : G.LOCATIONS[0].city, cur ? cur.district : null, cur ? cur.street : null);
  }
  function readLocSelects(root) {
    return { city: $('#loc-city').value, district: $('#loc-district').value, street: $('#loc-street').value, community: $('#loc-community').value };
  }

  // 通用弹窗
  function alertBox(title, msg) {
    var mask = el('<div class="modal-mask"><div class="modal"><h3>' + esc(title) + ' <span class="m-close">&#x2715;</span></h3>' +
      '<div style="font-size:13px;color:#555;line-height:1.8;white-space:pre-wrap;">' + esc(msg) + '</div></div></div>');
    $('#modal-root').appendChild(mask);
    mask.querySelector('.m-close').addEventListener('click', function () { mask.remove(); });
  }

  // 修改密码弹窗（账号+密码登录模式，走云端 API）
  function showChangePwd(u) {
    var mask = el('<div class="modal-mask"><div class="modal"><h3>修改密码 <span class="m-close" id="pwd-close">&#x2715;</span></h3>' +
      '<div style="margin:10px 0 4px;">' +
        '<label style="font-size:12px;color:#888;">原密码</label>' +
        '<input class="pwd-in" id="pwd-old" type="password" placeholder="请输入原密码" style="width:100%;box-sizing:border-box;margin-top:4px;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;">' +
        '<label style="font-size:12px;color:#888;display:block;margin-top:12px;">新密码（6-20 位）</label>' +
        '<input class="pwd-in" id="pwd-new" type="password" placeholder="请输入新密码" style="width:100%;box-sizing:border-box;margin-top:4px;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;">' +
        '<label style="font-size:12px;color:#888;display:block;margin-top:12px;">确认新密码</label>' +
        '<input class="pwd-in" id="pwd-new2" type="password" placeholder="请再次输入新密码" style="width:100%;box-sizing:border-box;margin-top:4px;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;">' +
        '<button class="btn-primary" id="pwd-submit" style="width:100%;margin-top:16px;">确认修改</button>' +
      '</div></div></div>');
    $('#modal-root').appendChild(mask);
    $('#pwd-close').addEventListener('click', function () { mask.remove(); });
    $('#pwd-submit').addEventListener('click', function () {
      var oldPwd = $('#pwd-old').value;
      var newPwd = $('#pwd-new').value;
      var newPwd2 = $('#pwd-new2').value;
      if (!oldPwd) { alertBox('提示', '请输入原密码'); return; }
      if (newPwd !== newPwd2) { alertBox('提示', '两次输入的新密码不一致'); return; }
      if (newPwd.length < 6 || newPwd.length > 20) { alertBox('提示', '新密码需为 6-20 位'); return; }
      var btn = $('#pwd-submit');
      btn.disabled = true; btn.textContent = '提交中…';
      D.cloud.changePassword(oldPwd, newPwd).then(function () {
        mask.remove();
        alertBox('修改成功', '密码已更新，请牢记新密码。');
      }).catch(function (e) { btn.disabled = false; btn.textContent = '确认修改'; alertBox('提示', e.message); });
    });
  }

  // ================= 路由 =================
  function parseHash() {
    var h = location.hash || '#/home';
    var parts = h.replace(/^#\//, '').split('/');
    var name = parts[0] || 'home';
    state.view = name;
if (name === 'product' && parts[1]) state.productId = parts[1];
    if (name === 'chat' && parts[1]) state.chatId = parts[1];
    if (name === 'profile' && parts[1]) state.profileTab = parts[1];
  }

  function init() {
    parseHash();
    window.addEventListener('hashchange', function () {
      parseHash();
      render();
    });
    // 跨标签页同步（聊一聊）
    D.onDBChange(function () {
      if (state.view === 'messages' || state.view === 'chat') render();
    });
    // 云端共享：启动时拉取云端全量合并进本地，实现 A 发布 B 可见（失败时用本地缓存照常运行）
    D.cloud.bootstrap().then(function (j) {
      if (j && j.data) D.mergeRemote(j.data);
      render();
    }).catch(function () { render(); });
  }

  // 管理后台入口（在 admin.js 中定义 render；主 INIT 等待其挂载）
  function renderAdminView(main) {
    if (global.SQYP_ADMIN) global.SQYP_ADMIN.render(main, global.SQYP_APP);
    else main.innerHTML = '<div class="empty">管理模块加载中…</div>';
  }

  global.SQYP_APP = {
    init: init, render: render, state: state,
    renderAdmin: renderAdminView,
    openChat: openChat, requireLogin: requireLogin
  };
})(window);