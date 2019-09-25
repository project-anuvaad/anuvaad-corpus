import redis
import json
import os

redis_ip = 'redis_ip'
default_value = 'localhost'
redis_server = os.environ.get(redis_ip, default_value)


redis_cli = redis.StrictRedis(host=redis_server, port=6379, charset="utf-8", decode_responses=True)

BASIC_AUTH_PREFIX = "AG-basic-auth:"
SCOPES = "scopes"


def get_user_roles_basic_auth(userId):
    
    key = BASIC_AUTH_PREFIX + userId
    value = redis_cli.hgetall(key)
    roles = value.get(SCOPES)
    if roles is None:
        return None
    return json.loads(roles) 
    

