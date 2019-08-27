from flask import Blueprint,jsonify, request,current_app as app
import os
import time
import uuid
from datetime import datetime
from models.status import Status
from models.response import CustomResponse
from models.single_corpus import Singlecorpus
from models.parallel_corpus import Parallelcorpus
from models.corpus_sentence import Corpussentence
from mongoengine import *
import json

corpus_api = Blueprint('corpus_api', __name__)
BASE_CORPUS = 'BASE_CORPUS'

@corpus_api.route("/upload-corpus", methods=['POST'])
def upload_corpus():
    global BASE_CORPUS
    basename = str(uuid.uuid4())
    f_corpus = request.files['corpus']
    name = request.form.getlist('name')
    domain = request.form.getlist('domain')
    lang = request.form.getlist('lang')
    if lang is None or len(lang)==0 or name is None or len(name) == 0 or len(name[0]) == 0 or domain is None or len(domain) == 0 or len(domain[0]) == 0 or request.files is None or request.files['corpus'] is None:
        res = CustomResponse(
                Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    description = ''
    if request.form.getlist('description') is not None and len(request.form.getlist('description')) > 0 and len(request.form.getlist('description')[0]) > 0:
        description = request.form.getlist('description')[0]
    corpus = Singlecorpus(created_on=datetime.now(),name=name[0],corpusid=basename,domain=domain[0],lang=lang[0],description=description)
    corpus.tags = [BASE_CORPUS,lang[0]]
    corpus.save()
    index = 0
    for f in f_corpus:
        sentence = Corpussentence(sentence=str(f),index=index)
        sentence.tags = [basename, lang[0]]
        sentence.original=True
        sentence.parallelcorpusid = []
        sentence.save()
        index+=1
    res = CustomResponse(Status.SUCCESS.value,None)
    return res.getres()

@corpus_api.route("/get-corpus", methods=['GET'])
def get_corpus_list():
    corpuses = Singlecorpus.objects.to_json()
    res = CustomResponse(Status.SUCCESS.value,json.loads(corpuses))
    return res.getres()

@corpus_api.route("/get-parallel-corpus", methods=['GET'])
def get_parallel_corpus_list():
    corpuses = Parallelcorpus.objects.to_json()
    res = CustomResponse(Status.SUCCESS.value,json.loads(corpuses))
    return res.getres()

@corpus_api.route("/get-parallel-corpus-sentences", methods=['GET'])
def get_parallel_corpus_sentences_list():
    basename = request.args.get('basename')
    if basename is None or len(basename)==0:
        res = CustomResponse(
                Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    parallel_corpus = Parallelcorpus.objects(basename=basename)
    if parallel_corpus is None or len(parallel_corpus) == 0:
        res = CustomResponse(
                Status.DATA_NOT_FOUND.value, None)
        return res.getres(), Status.DATA_NOT_FOUND.value['http']['status']
    parallel_corpus_dict = json.loads(parallel_corpus.to_json())
    source_sentences = Corpussentence.objects.filter(Q(tags=parallel_corpus_dict[0]['source_id']) & Q(parallelcorpusid=basename))
    target_sentences = Corpussentence.objects.filter(Q(tags=parallel_corpus_dict[0]['target_id']) & Q(parallelcorpusid=basename))
    data = {'source':json.loads(source_sentences.to_json()),'target':json.loads(target_sentences.to_json())}
    res = CustomResponse(Status.SUCCESS.value,data)
    return res.getres()


@corpus_api.route("/update-corpus-sentences", methods=['POST'])
def update_sentences():
    body = request.get_json()
    if(body['sentences'] is None or not isinstance(body['sentences'], list)):
        res = CustomResponse(
                Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    for sentence in body['sentences']:
        corpus = Sentence.objects(_id=sentence['_id']['$oid'])
        corpus_dict = json.loads(corpus.to_json())
        sentence_log = Sentencelog(source_words=corpus_dict[0]['source'].split(" "),target_words=corpus_dict[0]['target'].split(" "),source_edited_words=sentence['source'].split(" "),
        updated_on=datetime.now(),edited_by=request.headers.get('ad-userid'),parent_id=sentence['_id']['$oid'],target_edited_words=sentence['target'].split(" "),
        basename=corpus_dict[0]['basename'], source=corpus_dict[0]['source'], target=corpus_dict[0]['target'], source_edited = sentence['source'],target_edited=sentence['target'])
        sentence_log.save()
        corpus.update(set__source=sentence['source'],set__target=sentence['target'], set__status=STATUS_EDITED)
    res = CustomResponse(Status.SUCCESS.value, None)
    return res.getres()
    

@corpus_api.route("/create-parallel-corpus", methods=['POST'])
def create_parallel_corpus():
    body = request.get_json()
    if body['source_corpus'] is None or len(body['source_corpus']) == 0 or body['target_corpus'] is None or len(body['target_corpus']) == 0:
        res = CustomResponse(
                Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    basename = str(uuid.uuid4())
    source = body['source_corpus']
    target = body['target_corpus']
    name = body['name']
    domain = body['domain']
    source_corpus = Singlecorpus.objects(corpusid=source)
    target_corpus = Singlecorpus.objects(corpusid=target)
    if source_corpus is None or len(source_corpus) == 0 or target_corpus is None or len(target_corpus) == 0:
        res = CustomResponse(
                Status.DATA_NOT_FOUND.value, None)
        return res.getres(), Status.DATA_NOT_FOUND.value['http']['status']
    parallel_corpus = Parallelcorpus(name=name,domain=domain,basename=basename,source_id=source,target_id=target)
    parallel_corpus.save()
    source_sentences = Corpussentence.objects(tags=source)
    for source_sentence in source_sentences:
        source_sentence_dict = json.loads(source_sentence.to_json())
        source_sentence_tags = source_sentence_dict['parallelcorpusid']
        source_sentence_tags.append(basename)
        source_sentence.update(set__parallelcorpusid=source_sentence_tags)
    target_sentences = Corpussentence.objects(tags=target)
    for target_sentence in target_sentences:
        target_sentence_dict = json.loads(target_sentence.to_json())
        target_sentence_tags = target_sentence_dict['parallelcorpusid']
        target_sentence_tags.append(basename)
        target_sentence.update(set__parallelcorpusid=target_sentence_tags)
    res = CustomResponse(Status.SUCCESS.value,None)
    return res.getres()
