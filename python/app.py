from flask import Flask, jsonify, request
import os
from datetime import datetime
import time
from db.conmgr import getinstance
from controllers.pdftoimage import converttoimage
from controllers.imagetotext import convertimagetotext
from utils.process_paragraph import processhindi
from utils.process_paragraph_eng import processenglish
from utils.remove_page_number_filter import filtertext
from utils.translatewithgoogle import translatewithgoogle
from models.words import savewords
from werkzeug.utils import secure_filename
import subprocess
import json
import multiprocessing as mp
import codecs
from flask import Response
from models.status import Status
from models.response import Response
pool = mp.Pool(mp.cpu_count())


app = Flask(__name__)

UPLOAD_FOLDER = 'upload'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
es = getinstance()


@app.route('/', methods=['GET'])
def index():
    results = es.get(index='contents', doc_type='title', id='test')
    return jsonify(results['_source'])


@app.route('/uploader', methods=['GET', 'POST'])
def upload_file():
    basename = str(int(time.time()))
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
    f_eng = open('upload/' + basename + '_output-t', 'r')
    for f in f_eng:
        english_res.append(f)
    f_hin=open('upload/' + basename + '_output-s','r')
    for f in f_hin:
        hindi_res.append(f)
    data = {'hindi': hindi_res, 'english': english_res}
    res = Response(Status.SUCCESS.value, data)
    return res.getres()


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
    app.run()
