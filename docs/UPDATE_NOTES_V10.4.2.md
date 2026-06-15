# V10.4.2 公测版补全说明

## 版本名称

保持：V10.4.2 公测版。

## 不做的内容

- 不做 paid unlock。
- 不做支付宝解锁码。
- 不接 service_role key。
- 不允许人工编辑预测结果。
- 不删除 Supabase anon key 读取逻辑。

## 核心修复

### 1. scoreResolver

统一赛果读取优先级：

```text
data.postMatchResult.actualScore
→ data.actualScore
→ data.finalScore
→ data.homeScore + ':' + data.awayScore
```

### 2. 页面缓存

- `loadMatches()` 全局只发起一条数据请求。
- 页面切换只渲染，不重复请求 Supabase。
- localStorage 保存上一次成功结果。

### 3. 请求超时

- Supabase 请求默认 4 秒超时。
- 超时后直接显示本地缓存或演示数据。

### 4. 全部赛程 fallback

排序优先级：

```text
sortOrder / sort_order / order / matchNo
→ kickoff / date / matchDate / utcDate / time
→ id
```

搜索字段：

```text
homeCn / awayCn / home / away / group / stage / status / recommendation
```

### 5. 命中统计

- `actualScore = scoreResolver(match)`
- `predictionScores = predictions / topScores / modelScores / primaryScores / scoreOptions`
- 实际比分存在时才纳入统计。
