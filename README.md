# 2026FIFA世界杯预测 · V10.4.2 公测版

这是一个可直接上传 GitHub、再连接 Netlify 部署的静态前端项目包。

版本名称保持为：**V10.4.2 公测版**。

## 本版补全内容

1. **赛果字段兼容读取**
   - `data.postMatchResult.actualScore`
   - `data.actualScore`
   - `data.finalScore`
   - `data.homeScore + ':' + data.awayScore`

2. **全部赛程修复**
   - 不再因为 `date / kickoff / group / stage / status` 缺失而空白。
   - 缺时间时按 `id` 排序。
   - 搜索兼容球队中文名、英文名、阶段、状态、推荐方向。

3. **加载速度修复**
   - matches 数据全局只拉取一次。
   - 首页、全部赛程、统计、历史回测、V10数据层共用同一份缓存。
   - Supabase 请求 4 秒超时。
   - 超时或失败时使用本地缓存，不白屏等待 10 秒以上。

4. **赛后统计修复**
   - 命中统计使用统一 `scoreResolver`。
   - 只有存在真实赛后比分的比赛才参与命中率。

5. **V10 数据层状态位置调整**
   - 首页主体先显示比赛预测、赛程和统计。
   - V10 数据层诊断移动到首页下方。

## 目录结构

```text
.
├── index.html
├── netlify.toml
├── _redirects
├── assets
│   ├── css
│   │   └── style.css
│   └── js
│       ├── config.js
│       └── app.js
├── sql
│   ├── v10_4_2_fields_backfill.sql
│   ├── v10_4_2_fields_check.sql
│   └── supabase_read_policy_reference.sql
└── docs
    ├── NETLIFY_DEPLOY.md
    └── UPDATE_NOTES_V10.4.2.md
```

## 部署前必须配置

打开：

```text
assets/js/config.js
```

填写：

```js
SUPABASE_URL: '你的 Supabase Project URL',
SUPABASE_ANON_KEY: '你的 Supabase anon public key',
SUPABASE_TABLE: 'matches'
```

不要填写 `service_role key`。

## Netlify 设置

- Build command：留空
- Publish directory：`.`

## Supabase 数据库回填

如果你的数据库旧字段已经有比分，但新字段为空，先执行：

```text
sql/v10_4_2_fields_backfill.sql
```

然后执行检查：

```text
sql/v10_4_2_fields_check.sql
```

## 注意

本项目包是前端和 SQL 修复包。它不会替你写入 Supabase 密钥，也不会使用 service_role key。
