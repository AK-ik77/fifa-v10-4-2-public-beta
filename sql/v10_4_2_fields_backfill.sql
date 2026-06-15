-- V10.4.2 公测版：赛后比分字段回填脚本
-- 作用：把旧字段里的赛果同步到 V10 兼容字段，修复前端读不到赛果的问题。
-- 安全原则：只更新已经有真实比分的比赛；不人工改写预测结果；不需要 service_role key。

with score_source as (
  select
    id,
    regexp_replace(
      replace(
        coalesce(
          data #>> '{postMatchResult,actualScore}',
          data ->> 'actualScore',
          data ->> 'finalScore',
          case
            when data ->> 'homeScore' is not null and data ->> 'awayScore' is not null
            then (data ->> 'homeScore') || ':' || (data ->> 'awayScore')
            else null
          end
        ),
        '：',
        ':'
      ),
      '\s+',
      '',
      'g'
    ) as score
  from matches
  where coalesce(
    data #>> '{postMatchResult,actualScore}',
    data ->> 'actualScore',
    data ->> 'finalScore',
    case
      when data ->> 'homeScore' is not null and data ->> 'awayScore' is not null
      then (data ->> 'homeScore') || ':' || (data ->> 'awayScore')
      else null
    end
  ) ~ '^\s*[0-9]+\s*[:：]\s*[0-9]+\s*$'
)
update matches m
set data =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  coalesce(m.data, '{}'::jsonb),
                  '{postMatchResult,actualScore}',
                  to_jsonb(s.score),
                  true
                ),
                '{actualScore}',
                to_jsonb(s.score),
                true
              ),
              '{finalScore}',
              to_jsonb(s.score),
              true
            ),
            '{homeScore}',
            to_jsonb(split_part(s.score, ':', 1)::int),
            true
          ),
          '{awayScore}',
          to_jsonb(split_part(s.score, ':', 2)::int),
          true
        ),
        '{resultSyncStatus}',
        to_jsonb('synced'::text),
        true
      ),
      '{sourceStatus}',
      to_jsonb(coalesce(m.data ->> 'sourceStatus', 'legacy_backfilled')::text),
      true
    ),
    '{updatedAt}',
    to_jsonb(now()::text),
    true
  ) || jsonb_build_object('lastUpdated', now()::text)
from score_source s
where m.id = s.id;
