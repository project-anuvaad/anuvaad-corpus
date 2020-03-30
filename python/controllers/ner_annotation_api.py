import os
import urllib.request
from flask import Flask, request, redirect, render_template, jsonify
from flask import Blueprint, request, current_app as app
from controllers.sc_judgment_header_ner_eval import api_call
import json
from models.response import CustomResponse
from models.status import Status
ner_annotation_api = Blueprint('ner_annotation_api', __name__)


@ner_annotation_api.route('/ner', methods = ['POST'])
def ner_sentences(): 
    data = request.get_json()
    if 'sentence' not in data or data['sentence'] is None:
        res = CustomResponse(
            Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    else:
        text = data['sentence']
        model_dir = 'upload/models/model_1000/'
        result_ner = api_call(model_dir,text)
        if result_ner is None or model_dir is None:
            return "something went wrong"
        else:    
            res = CustomResponse(Status.SUCCESS.value, result_ner)
            return res.getres()

