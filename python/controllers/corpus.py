import json
import uuid
from datetime import datetime

from flask import Blueprint, request
from mongoengine import *

from models.corpus_sentence import Corpussentence
from models.parallel_corpus import Parallelcorpus
from models.response import CustomResponse
from models.sentence_log import Sentencelog
from models.single_corpus import Singlecorpus
from models.status import Status

corpus_api = Blueprint('corpus_api', __name__, url_prefix='/v1')
BASE_CORPUS = 'BASE_CORPUS'
STATUS_ACTIVE = 'ACTIVE'


@corpus_api.route("/upload-corpus", methods=['POST'])
def upload_corpus():
    global BASE_CORPUS, STATUS_ACTIVE
    basename = str(uuid.uuid4())
    f_corpus = request.files['corpus']
    name = request.form.getlist('name')
    domain = request.form.getlist('domain')
    lang = request.form.getlist('lang')
    if lang is None or len(lang) == 0 or name is None or len(name) == 0 or len(name[0]) == 0 or domain is None or len(
            domain) == 0 or len(domain[0]) == 0 or request.files is None or request.files['corpus'] is None:
        res = CustomResponse(
            Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    description = ''
    if request.form.getlist('description') is not None and len(request.form.getlist('description')) > 0 and len(
            request.form.getlist('description')[0]) > 0:
        description = request.form.getlist('description')[0]
    corpus = Singlecorpus(status=STATUS_ACTIVE, created_on=datetime.now(), name=name[0], corpusid=basename,
                          domain=domain[0], lang=lang[0], description=description,
                          created_by=request.headers.get('ad-userid'))
    corpus.tags = [BASE_CORPUS, lang[0]]
    corpus.save()
    index = 0
    for f in f_corpus:
        sentence = Corpussentence(sentence=str(f), index=index)
        sentence.tags = [basename, lang[0]]
        sentence.original = True
        sentence.parallelcorpusid = []
        sentence.created_by = request.headers.get('ad-userid')
        sentence.save()
        index += 1
    res = CustomResponse(Status.SUCCESS.value, None)
    return res.getres()


@corpus_api.route("/get-corpus", methods=['GET'])
def get_corpus_list():
    global STATUS_ACTIVE
    corpuses = Singlecorpus.objects(status=STATUS_ACTIVE).to_json()
    res = CustomResponse(Status.SUCCESS.value, json.loads(corpuses))
    return res.getres()


@corpus_api.route("/get-parallel-corpus", methods=['GET'])
def get_parallel_corpus_list():
    global STATUS_ACTIVE
    corpuses = Parallelcorpus.objects(status=STATUS_ACTIVE).to_json()
    res = CustomResponse(Status.SUCCESS.value, json.loads(corpuses))
    return res.getres()


@corpus_api.route("/get-parallel-corpus-sentences", methods=['GET'])
def get_parallel_corpus_sentences_list():
    basename = request.args.get('basename')
    if basename is None or len(basename) == 0:
        res = CustomResponse(
            Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    parallel_corpus = Parallelcorpus.objects(basename=basename)
    if parallel_corpus is None or len(parallel_corpus) == 0:
        res = CustomResponse(
            Status.DATA_NOT_FOUND.value, None)
        return res.getres(), Status.DATA_NOT_FOUND.value['http']['status']
    parallel_corpus_dict = json.loads(parallel_corpus.to_json())
    source_sentences = Corpussentence.objects.filter(
        Q(tags=parallel_corpus_dict[0]['source_id']) & Q(parallelcorpusid=basename)).order_by(
        'index')
    target_sentences = Corpussentence.objects.filter(
        Q(tags=parallel_corpus_dict[0]['target_id']) & Q(parallelcorpusid=basename)).order_by(
        'index')
    data = {'source': json.loads(source_sentences.to_json()), 'target': json.loads(target_sentences.to_json())}
    res = CustomResponse(Status.SUCCESS.value, data)
    return res.getres()


@corpus_api.route("/update-corpus-sentences", methods=['POST'])
def update_sentences():
    body = request.get_json()
    source_sentence = ''
    source_edited_sentence = ''
    target_sentence = ''
    target_edited_sentence = ''
    if body['id'] is None or (body['sentences'] is None or not isinstance(body['sentences'], list)):
        res = CustomResponse(
            Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    for sentence in body['sentences']:
        if sentence['source'] is not None:
            source = sentence['source']
            if '_id' in source and source['_id']['$oid'] is not None:
                source_db = Corpussentence.objects(_id=source['_id']['$oid'])
                if source_db is not None:
                    source_db_dict = json.loads(source_db.to_json())
                    source_sentence = source_db_dict[0]['sentence']
                    source_edited_sentence = source['sentence']
                    if source_db_dict[0]['original']:
                        parallelcorpusid = source_db_dict[0]['parallelcorpusid']
                        if body['id'] in parallelcorpusid:
                            parallelcorpusid.remove(body['id'])
                            source_db.update(parallelcorpusid=parallelcorpusid)
                            sentence = Corpussentence(sentence=source['sentence'], index=source_db_dict[0]['index'])
                            sentence.tags = source_db_dict[0]['tags']
                            sentence.original = False
                            sentence.parallelcorpusid = [body['id']]
                            sentence.created_by = request.headers.get('ad-userid')
                            sentence.save()
                    else:
                        source_db.update(sentence=source['sentence'])
                target = sentence['target']
                parallel_corpus = Parallelcorpus.objects(basename=body['id'])
                parallel_corpus_dict = json.loads(parallel_corpus.to_json())
                target_sentences = Corpussentence.objects(
                    Q(tags=parallel_corpus_dict[0]['target_id']) & Q(index=source['index']))
                target_edited_sentence = target['sentence']
                if target_sentences is not None and len(target_sentences) > 0:
                    target_sentence = json.loads(target_sentences.to_json())[0]['sentence']
                    target_sentences.update(set__sentence=target['sentence'])
                else:
                    sentence = Corpussentence(sentence=target['sentence'], index=source['index'])
                    sentence.tags = [parallel_corpus_dict[0]['target_id'], parallel_corpus_dict[0]['target_lang']]
                    sentence.original = False
                    sentence.parallelcorpusid = [body['id']]
                    sentence.created_by = request.headers.get('ad-userid')
                    sentence.save()
            sentence_log = Sentencelog(source_words=source_sentence.split(" "), target_words=target_sentence.split(" "),
                                       source_edited_words=source_edited_sentence.split(" "),
                                       updated_on=datetime.now(), edited_by=request.headers.get('ad-userid'),
                                       parent_id=sentence['source']['_id']['$oid'],
                                       target_edited_words=target_edited_sentence.split(" "),
                                       basename=body['id'], source=source_sentence, target=target_sentence,
                                       source_edited=source_edited_sentence, target_edited=target_edited_sentence)
            sentence_log.save()
    res = CustomResponse(Status.SUCCESS.value, None)
    return res.getres()


@corpus_api.route("/create-parallel-corpus", methods=['POST'])
def create_parallel_corpus():
    global STATUS_ACTIVE
    body = request.get_json()
    if body['source_corpus'] is None or len(body['source_corpus']) == 0:
        res = CustomResponse(
            Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    basename = str(uuid.uuid4())
    target_corpus_id = str(uuid.uuid4())
    source = body['source_corpus']
    name = body['name']
    domain = body['domain']
    target_lang = body['target_lang']
    source_lang = body['source_lang']
    corpus = Singlecorpus(status=STATUS_ACTIVE, created_on=datetime.now(), name=name, corpusid=target_corpus_id,
                          domain=domain, lang=target_lang, created_by=request.headers.get('ad-userid'))
    corpus.tags = [BASE_CORPUS, target_lang]
    corpus.save()
    source_corpus = Singlecorpus.objects(corpusid=source)
    if source_corpus is None or len(source_corpus) == 0:
        res = CustomResponse(
            Status.DATA_NOT_FOUND.value, None)
        return res.getres(), Status.DATA_NOT_FOUND.value['http']['status']
    parallel_corpus = Parallelcorpus(source_lang=source_lang, target_lang=target_lang, name=name, domain=domain,
                                     basename=basename, source_id=source, target_id=target_corpus_id,
                                     status=STATUS_ACTIVE)
    parallel_corpus.save()
    source_sentences = Corpussentence.objects(Q(tags=source) & Q(original=True))
    for source_sentence in source_sentences:
        source_sentence_dict = json.loads(source_sentence.to_json())
        source_sentence_tags = source_sentence_dict['parallelcorpusid']
        source_sentence_tags.append(basename)
        source_sentence.parallelcorpusid = source_sentence_tags
        source_sentence.save()
    res = CustomResponse(Status.SUCCESS.value, None)
    return res.getres()
