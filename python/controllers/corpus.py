from flask import Blueprint,jsonify, request,current_app as app
import uuid
from models.status import Status
from models.response import CustomResponse
from models.single_corpus import Corpussentence, Singlecorpus

corpus_api = Blueprint('corpus_api', __name__)

@corpus_api.route("/upload-corpus", methods=['POST'])
def upload_corpus():
    basename = str(uuid.uuid4())
    f_corpus = request.files['corpus']
    name = request.form.getlist('name')
    domain = request.form.getlist('domain')
    source_lang = request.form.getlist('source_lang')
    if name is None or len(name) == 0 or len(name[0]) == 0 or domain is None or len(domain) == 0 or len(domain[0]) == 0 or request.files is None or request.files['corpus'] is None:
        res = CustomResponse(
                Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
        return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
    sentences = []
    for f in f_corpus:
        sentence = Corpussentence(sentence=f)
        sentences.append(sentence)
    corpus = Singlecorpus(name=name[0],corpusid=basename,domain=domain[0],sentences=sentences)
    corpus.save()
    res = CustomResponse(Status.FAILURE.value,None)
    return res.getres()
