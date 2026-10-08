/* ============================================================
   三千优品（邻居好物）- 可选云数据库同步层
   -----------------------------------------------------------------
   - 目的：Render 等免费托管实例使用临时磁盘，重启/重新部署会
     丢失 backend/data/db.json。配置 POSTGRES_URL（Neon 免费
     Postgres）后，整库 JSON 以单行 kv 表方式同步到云数据库，
     重启后可恢复，数据不丢。
   - 兼容：未配置 POSTGRES_URL 时，本模块完全禁用，后端行为
     与旧版（仅本地文件）完全一致。
   - 依赖：@neondatabase/serverless（HTTP 驱动，Node 19+）
   - 版权：阿鲸渡喃出品
   ============================================================ */
'use strict';

const TABLE = 'sqyp_kv'; // k text PK, v jsonb

let sql = null;      // neon() 查询函数
let enabled = false; // 是否启用云同步

// 串行写队列，避免并发 saveDB 乱序
let pushQueue = Promise.resolve();

function init() {
  const url = process.env.POSTGRES_URL || process.env.NEON_URL || '';
  if (!url) return false;
  try {
    const { neon } = require('@neondatabase/serverless');
    sql = neon(url);
    enabled = true;
    console.log('[cloud] 云数据库同步已启用 (POSTGRES_URL)');
    return true;
  } catch (e) {
    console.warn('[cloud] 未找到 @neondatabase/serverless，云同步禁用: ' + e.message);
    return false;
  }
}

function isEnabled() {
  return enabled;
}

// 幂等建表
async function ensureTable() {
  if (!enabled) return;
  await sql`CREATE TABLE IF NOT EXISTS sqyp_kv (k text PRIMARY KEY, v jsonb NOT NULL)`;
}

// 从云拉取整库 JSON；无记录返回 null
async function pull() {
  if (!enabled) return null;
  const rows = await sql`SELECT v FROM sqyp_kv WHERE k = 'db'`;
  if (!rows || !rows.length) return null;
  return rows[0].v;
}

// 推送整库 JSON（UPSERT 单行）
async function push(obj) {
  if (!enabled) return;
  const json = JSON.stringify(obj);
  await sql`INSERT INTO sqyp_kv (k, v) VALUES ('db', ${json}::jsonb) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v`;
}

// 异步串行入队（不阻塞主流程），失败仅告警
function schedulePush(obj) {
  if (!enabled) return;
  pushQueue = pushQueue
    .then(() => push(obj))
    .catch((e) => console.warn('[cloud] 云同步写入失败（已保留本地文件）: ' + e.message));
}

// 启动时：确保表存在，尝试从云恢复；云为空则推送本地数据
async function syncOnBoot(bootstrapDB) {
  if (!enabled) return false;
  try {
    await ensureTable();
    const remote = await pull();
    if (remote && remote.users && remote.products) {
      console.log('[cloud] 已从云数据库恢复数据（用户 ' + remote.users.length + ' 商品 ' + remote.products.length + '）');
      return remote;
    }
    console.log('[cloud] 云数据库为空，推送本地初始数据');
    await push(bootstrapDB);
    return null;
  } catch (e) {
    console.warn('[cloud] 启动云同步失败，继续使用本地数据: ' + e.message);
    return null;
  }
}

module.exports = { init, isEnabled, ensureTable, pull, push, schedulePush, syncOnBoot };