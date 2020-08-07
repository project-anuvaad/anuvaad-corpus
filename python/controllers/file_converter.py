from flask import Blueprint, jsonify, request, current_app as app
import logging
import requests
import os
from uuid import uuid4
from subprocess import TimeoutExpired
from models.status import Status
from models.response import CustomResponse
from utils.libre_converter import LibreOfficeError, convert_to
from common.errors import RestAPIError, InternalServerErrorError
from shutil import copyfile

file_converter = Blueprint('file_converter', __name__)
NGINX_FOLDER = 'nginx'

log = logging.getLogger('file')


@file_converter.route("/convert-to-pdf", methods=['POST'])
def convert_to_pdf():
    body = request.get_json()
    upload_id = str(uuid4())
    filename = body['filename']
    filepath = os.path.join(NGINX_FOLDER, filename)
    try:
        result = convert_to(os.path.join(NGINX_FOLDER, 'pdf', upload_id), filepath, timeout=15)
        copyfile(result, os.path.join(NGINX_FOLDER, upload_id+'.pdf'))
    except LibreOfficeError:
        raise InternalServerErrorError({'message': 'Error when converting file to PDF'})
    except TimeoutExpired:
        raise InternalServerErrorError({'message': 'Timeout when converting file to PDF'})
    res = CustomResponse(Status.SUCCESS.value, upload_id+'.pdf')
    return res.getres()