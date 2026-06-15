-- V10.4.2 公测版：字段检查脚本
-- 执行后重点看 has_final_score / has_home_away_score / has_sync_status 是否接近 has_any_actual_score。

select
  count(*) as total_matches,
  count(*) filter (
    where coalesce(
      data #>> '{postMatchResult,actualScore}',
      data ->> 'actualScore',
      data ->> 'finalScore',
      case
        when data ->> 'homeScore' is not null and data ->> 'awayScore' is not null
        then (data ->> 'homeScore') || ':' || (data ->> 'awayScore')
        else null
      end
    ) is not null
  ) as has_any_actual_score,
  count(*) filter (where data #>> '{postMatchResult,actualScore}' is not null) as has_postmatch_actual_score,
  count(*) filter (where data ->> 'actualScore' is not null) as has_actual_score,
  count(*) filter (where data ->> 'finalScore' is not null) as has_final_score,
  count(*) filter (where data ->> 'homeScore' is not null and data ->> 'awayScore' is not null) as has_home_away_score,
  count(*) filter (where data ->> 'resultSyncStatus' is not null) as has_sync_status,
  count(*) filter (where data ->> 'updatedAt' is not null or data ->> 'lastUpdated' is not null) as has_updated_at
from matches;

-- 明细抽查
select
  id,
  data ->> 'homeCn' as home,
  data ->> 'awayCn' as away,
  data ->> 'status' as status,
  data #>> '{postMatchResult,actualScore}' as postmatch_actual_score,
  data ->> 'actualScore' as actual_score,
  data ->> 'finalScore' as final_score,
  data ->> 'homeScore' as home_score,
  data ->> 'awayScore' as away_score,
  data ->> 'resultSyncStatus' as result_sync_status,
  data ->> 'updatedAt' as updated_at,
  data ->> 'lastUpdated' as last_updated
from matches
where coalesce(
  data #>> '{postMatchResult,actualScore}',
  data ->> 'actualScore',
  data ->> 'finalScore'
) is not null
order by id
limit 50;
