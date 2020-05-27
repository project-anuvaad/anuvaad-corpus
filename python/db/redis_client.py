import redis
import json
import os

redis_ip = 'REDIS_URL'
default_value = 'localhost'
redis_server = os.environ.get(redis_ip, default_value)
express_gateway_schema = os.environ.get('EXPRESS_GATEWAY_SCHEMA','AG')


redis_cli = redis.StrictRedis(host=redis_server, port=6379, charset="utf-8", decode_responses=True)
redis_server = os.environ.get(redis_ip, default_value)
BASIC_AUTH_PREFIX = express_gateway_schema+"-basic-auth:"
SCOPES = "scopes"


def get_user_roles_basic_auth(userId):
    
    key = BASIC_AUTH_PREFIX + userId
    value = redis_cli.hgetall(key)
    roles = value.get(SCOPES)
    if roles is None:
        return None
    return json.loads(roles) 
    

