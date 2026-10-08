/*
 * aliyun-sms.js - 阿里云短信（动作 SendSms）纯 Node 实现，零第三方依赖。
 * 遵循阿里云 RPC 风格签名规范：SignatureMethod=HMAC-SHA1, SignatureVersion=1.0
 * 用法：sendSms(options, fetchImpl) -> Promise<{ ok:boolean, code:string, message:string, requestId:string }>
 * 环境变量：ALIYUN_AK_ID / ALIYUN_AK_SECRET / SMS_SIGN_NAME / SMS_TEMPLATE_CODE
 * 安全：AccessKey 只从环境变量读取，绝不写入代码、文件或日志。
 */
'use strict';

var crypto = require('crypto');

var ENDPOINT = 'https://dysmsapi.aliyuncs.com/';
var VERSION = '2017-05-25';

// 阿里云 URL 编码规则：A-Z a-z 0-9 - _ . ~ 不编码，其余字符编码为 %XX（RFC3986）
function percentEncode(str) {
  return encodeURIComponent(String(str))
    .replace(/[!'()*]/g, function (c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    })
    .replace(/%7E/g, '~')
    .replace(/\+/g, '%20');
}

function iso8601(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function hmacSha1Base64(secret, stringToSign) {
  return crypto.createHmac('sha1', secret).update(stringToSign, 'utf8').digest('base64');
}

function buildParams(opts) {
  var now = new Date();
  return {
    AccessKeyId: opts.accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: opts.phone,
    RegionId: 'cn-hangzhou',
    SignName: opts.signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: Math.random().toString(36).slice(2) + Date.now().toString(36),
    SignatureVersion: '1.0',
    TemplateCode: opts.templateCode,
    TemplateParam: JSON.stringify({ code: opts.code }),
    Timestamp: iso8601(now),
    Version: VERSION
  };
}

// 生成完整 GET 请求 URL（含 Signature）与规范化参数串，供底层 fetch 使用
function buildSignedUrl(opts) {
  var accessKeySecret = opts.accessKeySecret;
  var params = buildParams(opts);

  var sortedKeys = Object.keys(params).sort();
  var canonicalized = sortedKeys
    .map(function (k) { return percentEncode(k) + '=' + percentEncode(params[k]); })
    .join('&');

  var stringToSign = 'GET&' + percentEncode('/') + '&' + percentEncode(canonicalized);
  var signature = hmacSha1Base64(accessKeySecret + '&', stringToSign);

  return ENDPOINT + '?Signature=' + percentEncode(signature) + '&' + canonicalized;
}

// 发送短信验证码。fetchImpl 可注入（默认 globalThis.fetch），便于测试。
function sendSms(opts, fetchImpl) {
  var accessKeyId = opts.accessKeyId;
  var accessKeySecret = opts.accessKeySecret;
  var phone = opts.phone;
  var code = opts.code;
  var signName = opts.signName;
  var templateCode = opts.templateCode;

  if (!accessKeyId || !accessKeySecret) {
    return Promise.resolve({ ok: false, code: 'NO_CREDENTIAL', message: '未配置阿里云 AccessKey（环境变量 ALIYUN_AK_ID / ALIYUN_AK_SECRET）' });
  }
  if (!signName || !templateCode) {
    return Promise.resolve({ ok: false, code: 'NO_TEMPLATE', message: '未配置短信签名或模板（环境变量 SMS_SIGN_NAME / SMS_TEMPLATE_CODE）' });
  }
  if (!/^1\d{10}$/.test(phone)) {
    return Promise.resolve({ ok: false, code: 'BAD_PHONE', message: '手机号格式不正确' });
  }

  var url = buildSignedUrl({ accessKeyId: accessKeyId, accessKeySecret: accessKeySecret, phone: phone, code: code, signName: signName, templateCode: templateCode });
  var fetcher = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetcher) {
    return Promise.resolve({ ok: false, code: 'NO_FETCH', message: '当前运行环境不支持 fetch，请使用 Node 18+ 或注入 fetchImpl' });
  }

  return fetcher(url, { method: 'GET' })
    .then(function (res) { return res.json ? res.json() : res.text().then(JSON.parse); })
    .then(function (data) {
      var ok = data && data.Code === 'OK';
      return {
        ok: ok,
        code: ok ? 'OK' : (data && data.Code) || 'UNKNOWN',
        message: data && data.Message ? data.Message : '',
        requestId: data && data.RequestId ? data.RequestId : ''
      };
    })
    .catch(function (err) {
      return { ok: false, code: 'NETWORK', message: '调用短信服务失败：' + (err && err.message ? err.message : String(err)) };
    });
}

module.exports = { percentEncode: percentEncode, buildSignedUrl: buildSignedUrl, sendSms: sendSms, ENDPOINT: ENDPOINT };