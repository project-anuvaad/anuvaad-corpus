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
from utils.imagetotext_v2 import convertimagetotextv2
from utils.process_paragraph import processhindi
from utils.process_paragraph_eng import processenglish
from utils.remove_page_number_filter import filtertext
from utils.separate import separate
from utils.translatewithgoogle import translatewithgoogle
from models.words import savewords
from models.words import fetchwordsfromsentence
from models.sentence import Sentence
from werkzeug.utils import secure_filename
import subprocess
import json
import multiprocessing as mp
import codecs
from flask_cors import CORS
from flask import Response
from models.status import Status
from models.response import Response


app = Flask(__name__)
app.debug = True
CORS(app)

UPLOAD_FOLDER = 'upload'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
es = getinstance()
words = []
connectmongo()

@app.route('/', methods=['GET'])
def index():
    results = es.get(index='contents', doc_type='title', id='test')
    return jsonify(results['_source'])

@app.route('/single', methods=['POST'])
def upload_single_file():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
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
        filepath, app.config['UPLOAD_FOLDER'] + '/' + basename , basename), callback=capturetext)
    pool.close()
    pool.join()
    # global words
    # savewords(words)
    separate(app.config['UPLOAD_FOLDER'] + '/'+basename)
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
    f_eng = open('upload/' + basename + '_output-t', 'r')
    for f in f_eng:
        english_res.append(f)
        point = fetchwordsfromsentence(f, basename)
        english_points.append(point)
    f_hin = open('upload/' + basename + '_output-s', 'r')
    for f in f_hin:
        hindi_res.append(f)
        point = fetchwordsfromsentence(f, basename)
        hindi_points.append(point)
    data = {'hindi': hindi_res, 'english': english_res,
            'english_scores': english_points, 'hindi_scores': hindi_points}
    res = Response(Status.SUCCESS.value, data)
    sentences = []
    for i in range(0, len(hindi_res)):
        sentence  = Sentence(alignment_accuracy=english_res[i].split(':::::')[1],basename=str(basename),source=hindi_res[i],target=english_res[i].split(':::::')[0],source_ocr=str(hindi_points[i]),target_ocr=str(english_points[i]))
        sentences.append(sentence)
        # sentence.save()
    Sentence.objects.insert(sentences)
    for f in glob.glob('upload/'+basename+'*'):
        os.remove(f)
    return res.getres()


@app.route('/multiple', methods=['POST'])
def upload_file():
    print(mp.cpu_count())
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    f = request.files['hindi']
    f_eng = request.files['english']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '_hin.pdf')
    filepath_eng = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '_eng.pdf')
    f.save(filepath)
    f_eng.save(filepath_eng)
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
        filepath, app.config['UPLOAD_FOLDER'] + '/' + basename + '_hin', basename), callback=capturehindi)
    pool.apply_async(converttoimage, args=(
        filepath_eng, app.config['UPLOAD_FOLDER'] + '/' + basename + '_eng', basename), callback=captureenglish)
    pool.close()
    pool.join()
    # global words
    # savewords(words)
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
    f_eng = open('upload/' + basename + '_output-t', 'r')
    for f in f_eng:
        english_res.append(f)
        point = fetchwordsfromsentence(f, basename)
        english_points.append(point)
    f_hin = open('upload/' + basename + '_output-s', 'r')
    for f in f_hin:
        hindi_res.append(f)
        point = fetchwordsfromsentence(f, basename)
        hindi_points.append(point)
    data = {'hindi': hindi_res, 'english': english_res,
            'english_scores': english_points, 'hindi_scores': hindi_points}
    res = Response(Status.SUCCESS.value, data)
    for f in glob.glob('upload/'+basename+'*'):
        os.remove(f)
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


@app.route('/insert_data', methods=['POST'])
def insert_data():
    data = request.json
    slug = data['slug']
    title = data['title']
    content = data['content']
    body = {
        'slug': slug,
        'title': title,
        'content': content,
        'timestamp': datetime.now()
    }

    result = es.index(index='contents', doc_type='title', id=slug, body=body)

    return jsonify(result)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
