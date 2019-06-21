from flask import Flask, jsonify, request
import os
import glob
import sys
from datetime import datetime
import time
from db.conmgr import getinstance
from db.conmgr_mongo import connectmongo
from utils.pdftoimage import converttoimage
from utils.imagetotext import convertimagetotext
# from utils.imagetotext_v2 import convertimagetotextv2
from utils.process_paragraph import processhindi
from utils.process_paragraph_eng import processenglish
from utils.remove_page_number_filter import filtertext
from utils.separate import separate
from utils.translatewithgoogle import translatewithgoogle
from models.words import savewords
from models.words import fetchwordsfromsentence
from models.sentence import Sentence
from models.corpus import Corpus
from werkzeug.utils import secure_filename
import subprocess
import json
import multiprocessing as mp
import codecs
from flask_cors import CORS
from flask import Response
from models.status import Status
from models.response import CustomResponse

app = Flask(__name__)
app.debug = True
CORS(app)

UPLOAD_FOLDER = 'upload'
STATUS_PENDING = 'pending'
STATUS_PROCESSING = 'PROCESSING'
STATUS_PROCESSED = 'COMPLETED'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
es = getinstance()
words = []
connectmongo()

@app.route('/fetch-corpus', methods=['GET'])
def fetch_corpus():
    corpus = Corpus.objects.to_json()
    res = CustomResponse(Status.SUCCESS.value, json.loads(corpus))
    return res.getres()

@app.route('/fetch-sentences', methods=['GET'])
def fetch_sentences():
    basename = request.args.get('basename')
    sentences = Sentence.objects(basename=basename).to_json()
    res = CustomResponse(Status.SUCCESS.value, json.loads(sentences))
    return res.getres()


@app.route('/single', methods=['POST'])
def upload_single_file():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    corpus = Corpus(status=STATUS_PROCESSING, name=str(basename), domain='',created_on=current_time, last_modified=current_time, author='', comment='',no_of_sentences=0)
    # corpus.save()
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.pdf')
    f.save(filepath)
    # hin_result = converttoimage(
    #     filepath, app.config['UPLOAD_FOLDER'] + '/' + basename + '_hin', basename)
    # eng_result = converttoimage(
    #     filepath_eng, app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng', basename)
    # print(hin_result['imagenames'])
    # for imagename in hin_result['imagenames']:
    #     pool.apply_async(convertimagetotextv2, args=(
    #         os.getcwd() + '/'+ imagename, os.getcwd() + '/'+app.config['UPLOAD_FOLDER'] + '/' + basename + '_hin.txt', basename), callback=capturewords)
    # for imagename in eng_result['imagenames']:
    #     pool.apply_async(convertimagetotextv2, args=(
    #         imagename, app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng.txt', basename), callback=capturewords)

    pool.apply_async(converttoimage, args=(
        filepath, app.config['UPLOAD_FOLDER'] + '/' + basename, basename), callback=capturetext)
    pool.close()
    pool.join()
    # global words
    # savewords(words)
    separate(app.config['UPLOAD_FOLDER'] + '/'+basename)
    return process_files(basename)


@app.route('/multiple', methods=['POST'])
def upload_file():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    try:
        name = request.form.getlist('name')
        domain = request.form.getlist('domain')
        comment = request.form.getlist('comment')
        if comment is None or len(comment) == 0:
            comment = ['']
        if name is None or len(name) == 0 or domain is None or len(domain) == 0:
            res = CustomResponse(Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
            return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']
        
        else:
            print('saving the records')
            print(name)
            print(domain)
            print(comment)
            current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
            corpus = Corpus(status=STATUS_PROCESSING, name=name[0], domain=domain[0],created_on=current_time, last_modified=current_time, author='', comment=comment[0],no_of_sentences=0,basename=basename)
            corpus.save()
            f = request.files['hindi']
            f_eng = request.files['english']
            filepath = os.path.join(
                app.config['UPLOAD_FOLDER'], basename + '_hin.pdf')
            filepath_eng = os.path.join(
                app.config['UPLOAD_FOLDER'], basename + '_eng.pdf')
            f.save(filepath)
            f_eng.save(filepath_eng)
            pool.apply_async(converttoimage, args=(
                filepath, app.config['UPLOAD_FOLDER'] + '/' + basename + '_hin', basename), callback=capturehindi)
            pool.apply_async(converttoimage, args=(
                filepath_eng, app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng', basename), callback=captureenglish)
            pool.close()
            pool.join()
            return process_files(basename)
    except Exception as e:
            res = CustomResponse(Status.ERR_GLOBAL_SYSTEM.value, None)
            return res.getres(), Status.ERR_GLOBAL_SYSTEM.value['http']['status']


def process_files(basename):
    filtertext(app.config['UPLOAD_FOLDER'] + '/'+basename+'_hin.txt',
               app.config['UPLOAD_FOLDER'] + '/'+basename+'_hin_filtered.txt')
    filtertext(app.config['UPLOAD_FOLDER'] + '/'+basename+'_eng.txt',
               app.config['UPLOAD_FOLDER'] + '/'+basename+'_eng_filtered.txt')
    processhindi(app.config['UPLOAD_FOLDER'] +
                 '/'+basename+'_hin_filtered.txt')
    processenglish(app.config['UPLOAD_FOLDER'] +
                   '/'+basename+'_eng_filtered.txt')
    translatewithgoogle(app.config['UPLOAD_FOLDER'] +
                        '/'+basename+'_hin_filtered.txt', app.config['UPLOAD_FOLDER'] +
                        '/'+basename+'_eng_tran.txt')
    os.system('./helpers/bleualign.py -s ' + os.getcwd() + '/upload/' + basename + '_hin_filtered' + '.txt' + ' -t ' + os.getcwd() + '/upload/' + basename +
              '_eng_filtered' + '.txt' + ' --srctotarget ' + os.getcwd() + '/upload/' + basename + '_eng_tran' + '.txt' + ' -o ' + os.getcwd() + '/upload/' + basename + '_output')
    english_res = []
    hindi_res = []
    english_points = []
    hindi_points = []
    f_eng = open(app.config['UPLOAD_FOLDER']+'/' + basename + '_output-t', 'r')
    for f in f_eng:
        english_res.append(f)
        point = fetchwordsfromsentence(f, basename)
        english_points.append(point)
    f_hin = open(app.config['UPLOAD_FOLDER']+'/' + basename + '_output-s', 'r')
    for f in f_hin:
        hindi_res.append(f)
        point = fetchwordsfromsentence(f, basename)
        hindi_points.append(point)
    data = {'hindi': hindi_res, 'english': english_res,
            'english_scores': english_points, 'hindi_scores': hindi_points}
    sentences = []
    for i in range(0, len(hindi_res)):
        sentence = Sentence(status=STATUS_PENDING, alignment_accuracy=english_res[i].split(':::::')[1], basename=str(
            basename), source=hindi_res[i], target=english_res[i].split(':::::')[0], source_ocr=str(hindi_points[i]), target_ocr=str(english_points[i]))
        sentences.append(sentence)
        # sentence.save()
    Sentence.objects.insert(sentences)
    for f in glob.glob(app.config['UPLOAD_FOLDER']+'/'+basename+'*'):
        os.remove(f)
    res = CustomResponse(Status.SUCCESS.value, data)
    corpus = Corpus.objects(basename=basename)
    corpus.update(set__status=STATUS_PROCESSED, set__no_of_sentences=len(hindi_res))
    return res.getres()


def capturewords(result):
    print(result)
    global words
    words.append(result)


def capturetext(result):
    words = convertimagetotext(result['imagenames'], app.config['UPLOAD_FOLDER'] +
                               '/' + result['basename'] + '.txt', result['basename'])
    savewords(words)


def capturehindi(result):
    words = convertimagetotext(result['imagenames'], app.config['UPLOAD_FOLDER'] +
                               '/' + result['basename'] + '_hin.txt', result['basename'])
    savewords(words)


def captureenglish(result):
    words_eng = convertimagetotext(
        result['imagenames'], app.config['UPLOAD_FOLDER'] + '/' + result['basename'] + '_eng.txt', result['basename'])
    savewords(words_eng)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
