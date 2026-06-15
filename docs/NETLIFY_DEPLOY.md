# Netlify 部署说明

## 方式一：GitHub 连接部署

1. 把本项目包解压。
2. 上传到一个新的 GitHub 仓库。
3. Netlify 新建站点，选择该 GitHub 仓库。
4. 部署设置：
   - Build command：留空
   - Publish directory：`.`
5. 部署完成后打开域名检查页面。

## 方式二：Netlify 手动拖拽部署

1. 解压本项目包。
2. 先填写 `assets/js/config.js` 里的 Supabase URL 和 anon key。
3. 把整个文件夹拖到 Netlify Deploys 页面。

## 常见问题

### 页面显示演示数据

说明 `assets/js/config.js` 没填 Supabase URL / anon key，或者填错了。

### 页面加载很慢

本版已经加入 4 秒超时和本地缓存。如果仍慢，重点查：

- Supabase 表是否开启了 RLS 但没给 anon select policy；
- matches 表字段是否太大；
- 浏览器是否有网络限制；
- Supabase 免费项目是否冷启动。

### 全部赛程为空

本版默认不应该空白。若仍空，检查：

- `SUPABASE_TABLE` 是否等于你的真实表名；
- anon key 是否可读 matches；
- 浏览器控制台是否显示 Supabase HTTP 401 / 403 / 404。
