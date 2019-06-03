from flask import Flask, jsonify, request
import os
from datetime import datetime
import time
from db.conmgr import getinstance
from controllers.pdftoimage import converttoimage
from controllers.imagetotext import convertimagetotext
from models.words import savewords
from werkzeug.utils import secure_filename


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
    f = request.files['file']
    filepath = os.path.join(
        app.config['UPLOAD_FOLDER'], str(int(time.time())) + '.pdf')
    f.save(filepath)
    imagenames = converttoimage(
        filepath, app.config['UPLOAD_FOLDER'] + '/' + str(int(time.time())))
    words = convertimagetotext(imagenames)
    savewords(words)
    return 'file uploaded successfully'


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
