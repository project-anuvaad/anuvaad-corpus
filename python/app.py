"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
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
from utils.imagetoalto import convertimagetoalto
from utils.puttext import puttext
from utils.removetextv2 import removetext
from utils.imagetopdf import converttopdf
from utils.translateandupdateimage import translateandupdateimage
from utils.process_paragraph import processhindi
from utils.process_paragraph_eng import processenglish
from utils.remove_page_number_filter import filtertext
from utils.separate import separate
from utils.translatewithgoogle import translatewithgoogle
from utils.translatewithanuvada import translatewithanuvada
from utils.translatewithanuvada_eng import translatewithanuvadaeng
from models.words import savewords
from models.translation import Translation
from models.translation_process import TranslationProcess
from models.words import fetchwordsfromsentence, fetchwordhocrfromsentence
from models.sentence import Sentence
from models.corpus import Corpus
from werkzeug.utils import secure_filename
import subprocess
import json
import multiprocessing as mp
import codecs
from flask_cors import CORS
from flask import Response
import flask as flask
from models.status import Status
from models.response import CustomResponse
import utils.docx_translate_helper as docx_helper
import uuid
import logging
from logging.handlers import RotatingFileHandler


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


@app.route('/hello', methods=['GET'])
def hello_():
    app.logger.info('testing info log')
   
    return "hello"


@app.route('/fetch-corpus', methods=['GET'])
def fetch_corpus():
    corpus = Corpus.objects.to_json()
    res = CustomResponse(Status.SUCCESS.value, json.loads(corpus))
    return res.getres()

""" to get all the process from mongo in order of insertion """
@app.route('/fetch-translation-process', methods=['GET'])
def fetch_translation_process():
    app.logger.info('app:fetch_translation_process : started at '+ str(getcurrenttime()))
    try:
        transalationProcess = TranslationProcess.objects(created_by=request.headers.get('ad-userid')).order_by('-basename').to_json()
        res = CustomResponse(Status.SUCCESS.value, json.loads(transalationProcess))
    except:
            app.logger.info('app:fetch-translation-process : ERROR occured')
            pass    
    app.logger.info('app:fetch_translation_process : ended at '+ str(getcurrenttime()))
    return res.getres()


@app.route('/fetch-translation', methods=['GET'])
def fetch_translation():
    basename = request.args.get('basename')
    sentences = Translation.objects(basename=basename).to_json()
    res = CustomResponse(Status.SUCCESS.value, json.loads(sentences))
    return res.getres()


@app.route('/fetch-sentences', methods=['GET'])
def fetch_sentences():
    basename = request.args.get('basename')
    sentences = Sentence.objects(basename=basename).to_json()
    res = CustomResponse(Status.SUCCESS.value, json.loads(sentences))
    return res.getres()


@app.route('/translate-file', methods=['POST'])
def translateFile():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.pdf')
    translationProcess = TranslationProcess(
        status=STATUS_PROCESSING, name=f.filename, created_on=current_time, basename=basename)
    translationProcess.save()
    f.save(filepath)
    pool.apply_async(converttoimage, args=(
        filepath, app.config['UPLOAD_FOLDER'], basename, ''), callback=capturealtotext)
    pool.close()
    pool.join()
    
    res = CustomResponse(Status.SUCCESS.value, '')
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__status=STATUS_PROCESSED)
    return res.getres()


@app.route('/get-file-data', methods=['POST'])
def getfiledata():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.pdf')
    # translationProcess = TranslationProcess(
    #     status=STATUS_PROCESSING, name=f.filename, created_on=current_time, basename=basename)
    # translationProcess.save()
    f.save(filepath)
    pool.apply_async(converttoimage, args=(
        filepath, app.config['UPLOAD_FOLDER'], basename, '_eng'), callback=capturetext)
    pool.close()
    pool.join()
    filtertext(app.config['UPLOAD_FOLDER'] + '/'+basename+'_eng.txt',
               app.config['UPLOAD_FOLDER'] + '/'+basename+'_eng_filtered.txt')
    processenglish(app.config['UPLOAD_FOLDER'] +
                 '/'+basename+'_eng_filtered.txt')
    # translatewithanuvadaeng(app.config['UPLOAD_FOLDER'] +
    #                      '/'+basename+'_hin_filtered.txt', app.config['UPLOAD_FOLDER'] +
    #                      '/'+basename+'_eng_tran.txt')
    # f_eng = open(app.config['UPLOAD_FOLDER']+'/' +
    #              basename + '_eng_filtered.txt', 'r')
    english_res = []
    # hindi_res = []
    # for f in f_eng:
    #     english_res.append(f)
    # f_eng.close()
    f_eng = open(app.config['UPLOAD_FOLDER']+'/' +
                 basename + '_eng_filtered.txt', 'r')
    for f in f_eng:
        english_res.append(f)
    f_eng.close()
    data = {'english': english_res}
    # translations = []
    # for i in range(0, len(hindi_res)):
    #     translation = Translation(basename=str(
    #         basename), source=hindi_res[i], target=english_res[i])
    #     translations.append(translation)
    # Translation.objects.insert(translations)
    
    res = CustomResponse(Status.SUCCESS.value, data)
    result = flask.send_file(os.path.join('upload/',basename + '_eng_filtered.txt' ), as_attachment=True)
    result.headers["x-suggested-filename"] = basename + '.txt'

    # translationProcess = TranslationProcess.objects(basename=basename)
    # translationProcess.update(set__status=STATUS_PROCESSED)
    return result

@app.route('/translate', methods=['POST'])
def translate():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.pdf')
    translationProcess = TranslationProcess(
        status=STATUS_PROCESSING, name=f.filename, created_on=current_time, basename=basename)
    translationProcess.save()
    f.save(filepath)
    pool.apply_async(converttoimage, args=(
        filepath, app.config['UPLOAD_FOLDER'], basename, '_hin'), callback=capturetext)
    pool.close()
    pool.join()
    filtertext(app.config['UPLOAD_FOLDER'] + '/'+basename+'_hin.txt',
               app.config['UPLOAD_FOLDER'] + '/'+basename+'_hin_filtered.txt')
    processenglish(app.config['UPLOAD_FOLDER'] +
                 '/'+basename+'_hin_filtered.txt')
    translatewithanuvadaeng(app.config['UPLOAD_FOLDER'] +
                         '/'+basename+'_hin_filtered.txt', app.config['UPLOAD_FOLDER'] +
                         '/'+basename+'_eng_tran.txt')
    f_eng = open(app.config['UPLOAD_FOLDER']+'/' +
                 basename + '_eng_tran.txt', 'r')
    english_res = []
    hindi_res = []
    for f in f_eng:
        english_res.append(f)
    f_eng.close()
    f_hin = open(app.config['UPLOAD_FOLDER']+'/' +
                 basename + '_hin_filtered.txt', 'r')
    for f in f_hin:
        hindi_res.append(f)
    f_hin.close()
    data = {'hindi': hindi_res, 'english': english_res}
    translations = []
    for i in range(0, len(hindi_res)):
        translation = Translation(basename=str(
            basename), source=hindi_res[i], target=english_res[i])
        translations.append(translation)
    Translation.objects.insert(translations)
    for f in glob.glob(app.config['UPLOAD_FOLDER']+'/'+basename+'*'):
        os.remove(f)
    res = CustomResponse(Status.SUCCESS.value, data)
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__status=STATUS_PROCESSED)
    return res.getres()

@app.route('/download-docx', methods=['GET'])
def downloadDocx():
    filename = request.args.get('filename')
    result = flask.send_file(os.path.join('upload/', filename), as_attachment=True)
    result.headers["x-suggested-filename"] = filename
    return result

@app.route('/remove-process', methods=['POST'])
def delete_process():
    app.logger.info('app:delete_process: started at '+ str(getcurrenttime()))
    try :
        basename = request.form.getlist('processname')[0]
        app.logger.info('app:delte_process : requested basename is : '+basename)
        translationProcess = TranslationProcess.objects(basename=basename).delete()
        app.logger.info('app:delete_process: ended at '+ str(getcurrenttime()))
        res = CustomResponse(Status.SUCCESS.value,basename)
    except:
             app.logger.info('app:delte_process : ERROR while processing  basename  : '+basename)
             res = CustomResponse(Status.FAILURE.value,basename)
    return res.getres()
    

@app.route('/translate-docx', methods=['POST'])
def translateDocx():
    start_time = int(round(time.time() * 1000))
    app.logger.info('app:translateDocx: started at '+ str(start_time))
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.docx')

    sourceLang = request.form.getlist('sourceLang')[0]
    targetLang = request.form.getlist('targetLang')[0]
    translationProcess = TranslationProcess(created_by=request.headers.get('ad-userid'),
        status=STATUS_PROCESSING, name=f.filename, created_on=current_time, basename=basename,sourceLang=sourceLang,targetLang=targetLang)
    translationProcess.save()
    f.save(filepath)
    filename_to_processed = f.filename
    filepath_processed = os.path.join(
        app.config['UPLOAD_FOLDER'], basename +'_t'+'.docx')

    print(filename_to_processed)    

    xml_content = docx_helper.get_document_xml(filepath)
    xmltree = docx_helper.get_xml_tree(xml_content)

    nodes = []
    texts = []
    docx_helper.add_identification_tag(xmltree, str(uuid.uuid4()))
    docx_helper.pre_process_text(xmltree)

    for node, text in docx_helper.itertext(xmltree):
        nodes.append(node)
        texts.append(text)

    app.logger.info('app:translateDocx: number of nodes '+ str(len(nodes)) +' and text are : '+ str(len(texts)))

    """  method which don't use tokenization  """
    #docx_helper.modify_text(nodes)

    docx_helper.modify_text_with_tokenization(nodes, None)

    docx_helper.save_docx(filepath, xmltree, filepath_processed)
    
    res = CustomResponse(Status.SUCCESS.value,basename +'_t'+'.docx')
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__status=STATUS_PROCESSED)
    
    app.logger.info('app:translateDocx: ended at '+ str(getcurrenttime()) + 'total time elapsed : '+str(getcurrenttime()- start_time))
    return res.getres()

@app.route('/translate-docx-new', methods=['POST'])
def translateDocx():
    _url = 'http://18.236.30.130:3003/translator/translation_en'
    start_time = int(round(time.time() * 1000))
    app.logger.info('app:translateDocx-new: started at '+ str(start_time))
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.docx')

    sourceLang = request.form.getlist('sourceLang')[0]
    targetLang = request.form.getlist('targetLang')[0]
    translationProcess = TranslationProcess(created_by=request.headers.get('ad-userid'),
        status=STATUS_PROCESSING, name=f.filename, created_on=current_time, basename=basename,sourceLang=sourceLang,targetLang=targetLang)
    translationProcess.save()
    f.save(filepath)
    filename_to_processed = f.filename
    filepath_processed = os.path.join(
        app.config['UPLOAD_FOLDER'], basename +'_t'+'.docx')

    print(filename_to_processed)    

    xml_content = docx_helper.get_document_xml(filepath)
    xmltree = docx_helper.get_xml_tree(xml_content)

    nodes = []
    texts = []
    docx_helper.add_identification_tag(xmltree, str(uuid.uuid4()))
    docx_helper.pre_process_text(xmltree)

    for node, text in docx_helper.itertext(xmltree):
        nodes.append(node)
        texts.append(text)

    app.logger.info('app:translateDocx-new: number of nodes '+ str(len(nodes)) +' and text are : '+ str(len(texts)))

    """  method which don't use tokenization  """
    #docx_helper.modify_text(nodes)

    docx_helper.modify_text_with_tokenization(nodes, _url)

    docx_helper.save_docx(filepath, xmltree, filepath_processed)
    
    res = CustomResponse(Status.SUCCESS.value,basename +'_t'+'.docx')
    translationProcess = TranslationProcess.objects(basename=basename)
    translationProcess.update(set__status=STATUS_PROCESSED)
    
    app.logger.info('app:translateDocx-new: ended at '+ str(getcurrenttime()) + 'total time elapsed : '+str(getcurrenttime()- start_time))
    return res.getres()

@app.route('/single', methods=['POST'])
def upload_single_file():
    pool = mp.Pool(mp.cpu_count())
    basename = str(int(time.time()))
    current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
    corpus = Corpus(status=STATUS_PROCESSING, name=str(basename), domain='', created_on=current_time,
                    last_modified=current_time, author='', comment='', no_of_sentences=0)
    corpus.save()
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], basename + '.pdf')
    f.save(filepath)
    pool.apply_async(converttoimage, args=(
        filepath, app.config['UPLOAD_FOLDER'], basename, ''), callback=capturetext)
    pool.close()
    pool.join()
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
        if name is None or len(name) == 0 or len(name[0]) == 0 or domain is None or len(domain) == 0 or len(domain[0]) == 0 or request.files is None or request.files['hindi'] is None or request.files['english'] is None:
            res = CustomResponse(
                Status.ERR_GLOBAL_MISSING_PARAMETERS.value, None)
            return res.getres(), Status.ERR_GLOBAL_MISSING_PARAMETERS.value['http']['status']

        else:
            current_time = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
            corpus = Corpus(status=STATUS_PROCESSING, name=name[0], domain=domain[0], created_on=current_time,
                            last_modified=current_time, author='', comment=comment[0], no_of_sentences=0, basename=basename)
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
                filepath, app.config['UPLOAD_FOLDER'], basename, '_hin'), callback=capturetext)
            pool.apply_async(converttoimage, args=(
                filepath_eng, app.config['UPLOAD_FOLDER'], basename, '_eng'), callback=capturetext)
            pool.close()
            pool.join()
            return process_files(basename)
    except Exception as e:
        print(e)
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
    english_points_words = []
    hindi_points = []
    hindi_points_words = []
    f_eng = open(app.config['UPLOAD_FOLDER']+'/' + basename + '_output-t', 'r')
    for f in f_eng:
        english_res.append(f)
        point = fetchwordsfromsentence(f, basename)
        english_points.append(point['avg'])
        english_points_words.append(point['values'])
    f_eng.close()
    f_hin = open(app.config['UPLOAD_FOLDER']+'/' + basename + '_output-s', 'r')
    for f in f_hin:
        hindi_res.append(f)
        point = fetchwordsfromsentence(f, basename)
        hindi_points.append(point['avg'])
        hindi_points_words.append(point['values'])
    f_hin.close()
    data = {'hindi': hindi_res, 'english': english_res,
            'english_scores': english_points, 'hindi_scores': hindi_points}
    sentences = []
    for i in range(0, len(hindi_res)):
        sentence = Sentence(status=STATUS_PENDING, alignment_accuracy=english_res[i].split(':::::')[1], basename=str(
            basename), source=hindi_res[i], target=english_res[i].split(':::::')[0], source_ocr_words=hindi_points_words[i], source_ocr=str(hindi_points[i]), target_ocr_words=english_points_words[i], target_ocr=str(english_points[i]))
        sentences.append(sentence)
        # sentence.save()
    Sentence.objects.insert(sentences)
    for f in glob.glob(app.config['UPLOAD_FOLDER']+'/'+basename+'*'):
        os.remove(f)
    res = CustomResponse(Status.SUCCESS.value, data)
    corpus = Corpus.objects(basename=basename)
    corpus.update(set__status=STATUS_PROCESSED,
                  set__no_of_sentences=len(hindi_res))
    return res.getres()


def capturewords(result):
    print(result)
    global words
    words.append(result)


def capturetext(result):
    words = convertimagetotext(result['imagenames'], app.config['UPLOAD_FOLDER'] +
                               '/' + result['basename'] + result['suffix'] + '.txt', result['basename'])
    savewords(words)

def capturealtotext(result):
    convertimagetoalto(result['imagenames'], app.config['UPLOAD_FOLDER'] +
                               '/' + result['basename'] + result['suffix'], result['basename'])
    removetext(result['imagenames'], app.config['UPLOAD_FOLDER'] +
                               '/' + result['basename'] + result['suffix'])
    translateandupdateimage(result['imagenames'], app.config['UPLOAD_FOLDER'] +
                               '/' + result['basename'] + result['suffix'])
    converttopdf(result['imagenames'])

def getcurrenttime():
    return int(round(time.time() * 1000))

if __name__ == '__main__':
    logHandler = RotatingFileHandler('info.log', maxBytes=1000, backupCount=1)
    
    # set the log handler level
    logHandler.setLevel(logging.INFO)

    # set the app logger level
    app.logger.setLevel(logging.INFO)

    app.logger.addHandler(logHandler)  
    app.run(host='0.0.0.0', port=5001)
