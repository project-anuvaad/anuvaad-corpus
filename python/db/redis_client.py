import redis
import json

redis_cli = redis.StrictRedis(host="localhost", port=6379, charset="utf-8", decode_responses=True)

BASIC_AUTH_PREFIX = "AG-basic-auth:"
SCOPES = "scopes"


def get_user_roles_basic_auth(userId):
    
    key = BASIC_AUTH_PREFIX +  userId
    value = redis_cli.hgetall(key)
    roles = value.get(SCOPES)
    return json.loads(roles) 
    

