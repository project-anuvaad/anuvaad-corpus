import subprocess
import json
import logging

CREATE_BASIC_AUTH_BASE = 'eg credentials create -c '
CREATE_BASIC_AUTH_PART = ' -t basic-auth -p "password='

CREATE_USER_BASE = 'eg users create -p '

log = logging.getLogger('file')


def create_basic_auth_credentials(username, password):
    command = CREATE_BASIC_AUTH_BASE + username + CREATE_BASIC_AUTH_PART + password + '"'
    p = subprocess.call(command , shell=True)
    # (output, err) = p.communicate()
    # data = json.loads(output.decode('utf-8'))
    return 'success'


def create_user(username, firstname, lastname):
    try:
        command = CREATE_USER_BASE + '\'username=' + username + '\' -p \'firstname=' + firstname + '\' -p \'lastname=' + lastname + '\' ';
        log.info(command)
        p = subprocess.call(command, shell=True)
        # (output, err) = p.communicate()
        # log.info(str(output))
        # log.error(str(err))
        # data = json.loads(output.decode('utf-8'))
        return 'success'
    except Exception as e:
        return None


def scope_add(username, scopes):
    try:
        scope = ''
        for s in scopes:
            scope = scope + 's '
        log.info('scope is '+ scope)
        command = 'eg credential:scopes add -t basic-auth --id ' + username + ' ' + scope
        p = subprocess.call(command, shell=True)
        # (output, err) = p.communicate()
        # data = json.loads(output.decode('utf-8'))
        # log.info(' scope_add : response for username = ' + username + ', scope = ' + str(data))
        return 'success'
    except Exception as e:
        return None


def create_oauth(user_name):
    try:
        command = 'eg credentials create -c ' + user_name + '-t oauth2'
        p = subprocess.Popen(command, stdout=subprocess.PIPE, shell=True)
        (output, err) = p.communicate()
        data = json.loads(output.decode('utf-8'))
        return data
    except Exception as e:
        return None


def get_credential_info(username):
    profile = get_user_info(username)
    command = 'eg credentials info - t oauth2 ' + profile['id']
    try:
        p = subprocess.Popen(command, stdout=subprocess.PIPE, shell=True)
        (output, err) = p.communicate()
        data = json.loads(output.decode('utf-8'))
        return data
    except Exception as e:
        return None


def get_user_info(username):
    command = ' eg users info ' + username
    try:
        p = subprocess.Popen(command, stdout=subprocess.PIPE, shell=True)
        (output, err) = p.communicate()
        data = json.loads(output.decode('utf-8'))
        return data
    except Exception as e:
        return None