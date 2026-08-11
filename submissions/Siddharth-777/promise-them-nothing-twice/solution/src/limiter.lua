-- Atomic sliding window log rate limiter.
-- Loaded once via defineCommand. Never inlined as a string in JS.
--
-- KEYS[1] = ratelimit:{customer_id}
-- ARGV[1] = base_limit (number)
-- ARGV[2] = override_limit (number, 0 if no override)
-- ARGV[3] = override_start (seconds since midnight UTC)
-- ARGV[4] = override_end (seconds since midnight UTC)
-- ARGV[5] = window_size (seconds, always 60)

-- Step 1: Obtain Redis server time
local time = redis.call('TIME')
local now_seconds = tonumber(time[1])
local now_microseconds = tonumber(time[2])
local now_micro = now_seconds * 1000000 + now_microseconds

-- Atomic counter for unique member suffix (prevents same-microsecond collisions)
local seq = redis.call('INCR', KEYS[1] .. ':seq')

-- Step 2: Determine effective limit
local base_limit = tonumber(ARGV[1])
local override_limit = tonumber(ARGV[2])
local override_start = tonumber(ARGV[3])
local override_end = tonumber(ARGV[4])
local window_size = tonumber(ARGV[5])

local effective_limit = base_limit

if override_limit > 0 then
  -- Convert current time to seconds since midnight UTC
  local seconds_since_midnight = now_seconds % 86400

  if override_start <= override_end then
    -- Normal window (e.g., 02:00-04:00)
    if seconds_since_midnight >= override_start and seconds_since_midnight < override_end then
      effective_limit = override_limit
    end
  else
    -- Midnight-crossing window (e.g., 23:30-00:30)
    if seconds_since_midnight >= override_start or seconds_since_midnight < override_end then
      effective_limit = override_limit
    end
  end
end

-- Step 3: Prune expired timestamps outside the sliding window
local window_micro = window_size * 1000000
local window_start = now_micro - window_micro
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', window_start)

-- Step 4: Count active timestamps remaining in the window
local current_count = redis.call('ZCARD', KEYS[1])

-- Step 5: Compare with limit
if current_count >= effective_limit then
  -- Rejected: calculate Retry-After from the oldest active timestamp
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local retry_after = 0
  if #oldest > 0 then
    local oldest_micro = tonumber(oldest[2])
    -- Time until the oldest entry expires out of the window
    local remaining_micro = (oldest_micro + window_micro) - now_micro
    -- Ceiling division to whole seconds
    retry_after = math.ceil(remaining_micro / 1000000)
    if retry_after < 1 then
      retry_after = 1
    end
  end

  return {0, current_count, effective_limit, retry_after, now_seconds, now_microseconds}
end

-- Step 6: Allowed — record this request's timestamp
redis.call('ZADD', KEYS[1], now_micro, now_micro .. '-' .. seq)
current_count = current_count + 1

-- Step 7: Set TTL to auto-expire idle keys
redis.call('PEXPIRE', KEYS[1], window_size * 1000)

-- Step 8: Return allowed result
return {1, current_count, effective_limit, 0, now_seconds, now_microseconds}
