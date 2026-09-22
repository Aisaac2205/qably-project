export const RECORD_SUITE_RESULT_SCRIPT = `
local key = KEYS[1]
local sizeArg = ARGV[1]
local organizationId = ARGV[2]
local projectId = ARGV[3]
local reportExternalId = ARGV[4]
local resultField = ARGV[5]
local resultValue = ARGV[6]

local existingSize = redis.call('HGET', key, 'size')
local created = 0
if existingSize == false then
  created = 1
  redis.call('HSET', key, 'size', sizeArg)
  redis.call('HSET', key, 'organizationId', organizationId)
  redis.call('HSET', key, 'projectId', projectId)
  redis.call('HSET', key, 'reportExternalId', reportExternalId)
elseif tonumber(sizeArg) > tonumber(existingSize) then
  redis.call('HSET', key, 'size', sizeArg)
end
redis.call('HSET', key, resultField, resultValue)
redis.call('EXPIRE', key, 600)

local flat = redis.call('HGETALL', key)
local map = {}
local resultCount = 0
for i = 1, #flat, 2 do
  local field = flat[i]
  local value = flat[i + 1]
  map[field] = value
  if string.sub(field, 1, 7) == 'result:' then
    resultCount = resultCount + 1
  end
end

local size = tonumber(map['size'])
if resultCount < size then
  return cjson.encode({complete = false, created = created})
end

redis.call('DEL', key)
return cjson.encode({complete = true, created = created, data = map})
`;

export const FLUSH_BATCH_SCRIPT = `
local key = KEYS[1]
local flat = redis.call('HGETALL', key)
if #flat == 0 then
  return cjson.encode({found = false})
end

redis.call('DEL', key)
local map = {}
for i = 1, #flat, 2 do
  map[flat[i]] = flat[i + 1]
end
return cjson.encode({found = true, data = map})
`;
