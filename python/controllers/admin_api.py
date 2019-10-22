from flask import Blueprint, jsonify, request, current_app as app
import logging
import requests
import time
from models.status import Status
from models.response import CustomResponse
from db.redis_client import get_user_roles_basic_auth
import json
import time
import utils.run_on_shell as shell
import base64
import os

GATEWAY_SERVER_URL = os.environ.get('GATEWAY_URL', 'http://localhost:9876/')
PROFILE_REQ_URL = GATEWAY_SERVER_URL + 'users/'
log = logging.getLogger('file')

admin_api = Blueprint('admin_api', __name__)


@admin_api.route("/create-user-oauth", methods=['POST'])
def create_user_oauth():
    log.info('create_user_oauth : started')
    body = request.get_json()
    user_name = body['username']

    try:

        response = shell.create_oauth(user_name)
        res = CustomResponse(Status.SUCCESS.value, response)
        return res.getres()
    except Exception as e:
        log.info('create_user_oauth : error ' + str(e))
        res = CustomResponse(Status.ERROR_GATEWAY.value, None)
        return res.getres()


@admin_api.route("/create-user", methods=['POST'])
def create_user_basic_auth():
    log.info('create_user_basic_auth : started')
    body = request.get_json()
    user_name = body['username']
    firstname = body['firstname']
    lastname = body['lastname']
    password = body['password']
    scope = body['roles']

    try:
        profile = requests.get(PROFILE_REQ_URL + user_name)
        try:
            profile = profile.json()
            if profile['isActive']:
                # _id = profile['']
                log.info('create_user_oauth : profile is = : ' + str(profile))
                res = CustomResponse(Status.USER_ALREADY_EXISTS.value, None)
                return res.getres()
        except:
            pass

        log.info('here')
        create_response = shell.create_user(user_name, firstname, lastname)
        log.info('user created')
        shell_response = shell.create_basic_auth_credentials(user_name, password)
        log.info('basic auth created')
        response = shell.create_oauth(user_name)
        log.info('oauth created')
        user = shell.get_user_info(user_name)
        log.info(str(user))
        scope_response = shell.scope_add(user['id'], scope)
        time.sleep(3)
        log.info('scope added')
        res = CustomResponse(Status.SUCCESS.value, response)
        return res.getres()

    except Exception as e:
        log.info(' create_user : error ' + str(e))
        res = CustomResponse(Status.ERROR_GATEWAY.value, None)
        return res.getres()


@admin_api.route("/update-password", methods=['POST'])
def update_password():
    log.info('update_password : started')
    body = request.get_json()
    user_id = body['user_id']
    user_name = body['user_name']
    old_password = body['old_password']
    new_password = body['new_password']

    password_checked = check_password(user_name, old_password)
    if not password_checked:
        res = CustomResponse(Status.ERROR_WRONG_PASSWORD.value, None)
        return res.getres()

    if new_password is None or new_password.__len__() < 6:
        log.info('update_password : password is too weak, at least provide 6 characters')
        res = CustomResponse(Status.ERROR_WEAK_PASSWORD.value, None)
        return res.getres()
    data = {"status": "false"}
    req = GATEWAY_SERVER_URL + 'credentials/basic-auth/' + user_id + '/status'
    response = requests.put(req, json=data)
    res = response.json()
    status = res['status']
    log.info("status == " + status)
    if not status == 'Deactivated':
        res = CustomResponse(Status.ERROR_GATEWAY.value, None)
        return res.getres()
    shell_response = shell.create_basic_auth_credentials(user_id, new_password)
    if shell_response['isActive']:
        res = CustomResponse(Status.SUCCESS.value, None)
        return res.getres()
    res = CustomResponse(Status.FAILURE.value, None)
    return res.getres()

@admin_api.route("/update-password-admin", methods=['POST'])
def update_password_admin():
    log.info('update_password : started')
    body = request.get_json()
    user_id = body['user_id']
    user_name = body['user_name']
    new_password = body['new_password']
    if new_password is None or new_password.__len__() < 6:
        log.info('update_password : password is too weak, at least provide 6 characters')
        res = CustomResponse(Status.ERROR_WEAK_PASSWORD.value, None)
        return res.getres()
    data = {"status": "false"}
    req = GATEWAY_SERVER_URL + 'credentials/basic-auth/' + user_id + '/status'
    response = requests.put(req, json=data)
    res = response.json()
    status = res['status']
    log.info("status == " + status)
    if not status == 'Deactivated':
        res = CustomResponse(Status.ERROR_GATEWAY.value, None)
        return res.getres()
    shell_response = shell.create_basic_auth_credentials(user_id, new_password)
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
                    response = requests.post(GATEWAY_SERVER_URL + 'scopes')
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
            roles_ = get_user_roles_basic_auth(user_id)
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


@admin_api.route('/get-profiles', methods=['POST'])
def get_user_profiles():
    log.info('get_user_profile : started at ' + str(getcurrenttime()))
    body = request.get_json()
    if body['userids'] is None or not isinstance(body['userids'], list):
        res = CustomResponse(
            Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    user_profiles = []
    for user_id in body['userids']:
        log.info('get_user_profile : userid = ' + user_id)
        res = None
        try:
            profile = requests.get(PROFILE_REQ_URL + user_id).content
            profile = json.loads(profile)
            roles_ = get_user_roles_basic_auth(user_id)
            profile['roles'] = roles_
            user_profiles.append(profile)
        except Exception as e:
            log.error(e)
            res = CustomResponse(Status.FAILURE.value,
                                 'user does not exists with user-id :' + request.headers.get('ad-userid'))
    res = CustomResponse(Status.SUCCESS.value, user_profiles)
    return res.getres()


def getcurrenttime():
    return int(round(time.time() * 1000))


def check_password(username, password):
    data = username + ':' + password

    encodedBytes = base64.b64encode(data.encode("utf-8"))
    encodedStr = str(encodedBytes, "utf-8")
    headers = {"Authorization": "Basic %s" % encodedStr}
    response = requests.get('http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/app/hello', headers=headers)

    log.info('check_password: response is ')
    log.info(response.__dict__)
    try:
        if response.__dict__['status_code'] == 200:
            return True
        else:
            return False
    except:
        return False
