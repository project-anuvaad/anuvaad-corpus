"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """

import enum


class Status(enum.Enum):
    SUCCESS = {'ok': True, 'http': {'status': 200},
               'why': "request successful"}
    ERR_GLOBAL_SYSTEM = {'ok': False, 'http': {
        'status': 500}, 'why': "Internal Server Error"}
    ERR_GLOBAL_MISSING_PARAMETERS = {
        'ok': False, 'http': {'status': 400}, 'why': "Data Missing"}
    FAILURE = {'ok': False,'http':{'status':200},
                'why':'request failed'}
    OPERATION_NOT_PERMITTED = {'ok': False,'http':{'status':400},
                'why':'operation not permitted'}
    
     
