/*
  V10.4.2 公测版配置文件
  只使用 Supabase anon key，不要放 service_role key。

  使用方法：
  1. 在 Supabase Dashboard -> Project Settings -> API 复制 Project URL
  2. 复制 Project API keys 里的 anon public key
  3. 粘贴到下面两个字段
*/
window.FIFA_CONFIG = {
  VERSION: 'V10.4.2 公测版',
  TITLE: '2026FIFA世界杯预测',

  // 必填：你的 Supabase Project URL，例如 https://xxxx.supabase.co
  SUPABASE_URL: '',

  // 必填：你的 Supabase anon public key。不要填写 service_role key。
  SUPABASE_ANON_KEY: '',

  // 数据表名。如你的表不是 matches，请改这里。
  SUPABASE_TABLE: 'matches',

  // 请求超时：4秒。超时后直接使用本地缓存，避免页面卡 10 秒以上。
  REQUEST_TIMEOUT_MS: 4000,

  // 自动刷新间隔。默认 5 分钟。
  AUTO_REFRESH_MS: 5 * 60 * 1000,

  // 每次最多拉取比赛数。世界杯比赛数较少，默认 500 足够。
  FETCH_LIMIT: 500,

  // 没有配置 Supabase 时显示内置演示数据，方便先看页面。
  USE_DEMO_WHEN_NOT_CONFIGURED: true
};
window.WC_SUPABASE_URL = "https://ovmlorwcjodcrocmxzva.supabase.co";
window.WC_SUPABASE_ANON_KEY = "sb_publishable_4txLl-xZg_wqw8I7WIH4Ig_eGQ7AR4f";
window.WC_DATA_MODE = "supabase";
