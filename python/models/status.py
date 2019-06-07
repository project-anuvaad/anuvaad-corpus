import enum 

class Status(enum.Enum): 
    SUCCESS= { 'ok': True, 'http': { 'status': 200 }, 'why': "request successful" }
    ERR_GLOBAL_SYSTEM= { 'ok': False, 'http': { 'status': 500 }, 'why': "Internal Server Error" }