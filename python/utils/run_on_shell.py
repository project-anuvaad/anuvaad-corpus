import subprocess
import json

CREATE_BASIC_AUTH_BASE = 'eg credentials create -c '
CREATE_BASIC_AUTH_PART = ' -t basic-auth -p "password='


def create_basic_auth_credentials(username, password):
    command = CREATE_BASIC_AUTH_BASE + username + CREATE_BASIC_AUTH_PART + password + '"'
    p = subprocess.Popen(command, stdout=subprocess.PIPE, shell=True)
    (output, err) = p.communicate()
    data = json.loads(output.decode('utf-8'))
    return data