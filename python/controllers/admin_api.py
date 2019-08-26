from flask import Blueprint, jsonify, request, current_app as app
import logging
import requests
from models.status import Status
from models.response import CustomResponse
from db.redis_client import redis_cli
import json
import time
import utils.run_on_shell as shell

ES_SERVER_URL = 'http://localhost:9876/'
PROFILE_REQ_URL = ES_SERVER_URL + 'users/'
log = logging.getLogger('file')

admin_api = Blueprint('admin_api', __name__)


@admin_api.route("/update-password", methods=['POST'])
def update_password():
    log.info('update_password : started')
    body = request.get_json()
    user_id = body['user_id']
    password = body['password']
    log.info("password == "+password + " username == "+user_id )
    if password is None or password.__len__() < 6:
        log.info('update_password : password is too weak, at least provide 6 characters')
        res = CustomResponse(Status.ERROR_WEAK_PASSWORD.value, None)
        return res.getres()
    data = {"status": "false"}
    req = ES_SERVER_URL + 'credentials/basic-auth/' + user_id + '/status'
    response = requests.put(req, json=data)
    res = response.json()
    status = res['status']
    log.info("status == "+status)
    if not status == 'Deactivated':
        res = CustomResponse(Status.ERROR_GATEWAY.value, None)
        return res.getres()
    shell_response = shell.create_basic_auth_credentials(user_id, password)
    if shell_response['isActive']:
        res = CustomResponse(Status.SUCCESS.value, None)
        return res.getres()
    res = CustomResponse(Status.FAILURE.value, None)
    return res.getres()


""" to create scope/roles """


@admin_api.route('/roles', methods=['POST'])
def roles():
    body = request.get_json()
    res = None
    if body['operation'] is not None and body['role-type'] is not None:
        if body['operation'] == "create":
            if not body['role-type'] == '':

                try:
                    response = requests.post(ES_SERVER_URL + 'scopes')
                    res = CustomResponse(Status.SUCCESS.value, json.loads(response))

                except:
                    res = CustomResponse(Status.FAILURE.value, None)

            else:
                res = CustomResponse(Status.ERR_GLOBAL_MISSING_PARAMETERS.value, ' role-type not provided ')
        else:
            res = CustomResponse(Status.OPERATION_NOT_PERMITTED.value, 'supported opertion type are : [create] ')
    else:
        res = CustomResponse(Status.ERR_GLOBAL_MISSING_PARAMETERS.value, ' please provide operation and role-type ')

    return res.getres()


@admin_api.route('/get-profile', methods=['GET'])
def get_user_profile():
    log.info('get_user_profile : started at ' + str(getcurrenttime()))
    if request.headers.get('ad-userid') is not None:
        user_id = request.headers.get('ad-userid')
        log.info('get_user_profile : userid = ' + user_id)
        res = None
        try:
            profile = requests.get(PROFILE_REQ_URL + request.headers.get('ad-userid')).content
            profile = json.loads(profile)
            roles_ = redis_cli.get_user_roles_basic_auth(user_id)
            profile['roles'] = roles_
            res = CustomResponse(Status.SUCCESS.value, profile)

        except Exception as e:
            log.error(e)
            res = CustomResponse(Status.FAILURE.value,
                                 'user does not exists with user-id :' + request.headers.get('ad-userid'))
        log.info('get_user_profile : ended at ' + str(getcurrenttime()))
        return res.getres()
    log.error('get_user_profile : Error : userid not provided')
    res = CustomResponse(Status.FAILURE.value, 'please provide valid userid ')
    return res.getres()


def getcurrenttime():
    return int(round(time.time() * 1000))
