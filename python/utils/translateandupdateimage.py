from PIL import Image
from pytesseract import pytesseract
import argparse
import xmltodict
import json
import cv2
import os
import requests
from utils.puttext import puttext
from nltk.tokenize import sent_tokenize
import math

def translateandupdateimage(imagepaths, outputpath):
    index = 0
    for imagepath in imagepaths:
        o_filename = imagepath
        f_alto = open(outputpath+'_'+str(index)+'.xml', "r")
        # print(xmltodict.parse(f_hin.read()))
        data = xmltodict.parse(f_alto.read())
        f_alto.close()
        blocks = data['alto']['Layout']['Page']['PrintSpace']['TextBlock']
        for block in blocks:
            textline = block['TextLine']
            text = ''
            height = 0
            x = block['@HPOS']
            y = block['@VPOS']
            word_count = 0
            no_lines = 0
            line_height = 0
            if isinstance(textline, list):
                no_lines = len(textline)
                print(no_lines)
                line_height = int(block['@HEIGHT']) / len(textline)
                for line in textline:
                    if line['String'] is not None:
                        words = line['String']
                        if height == 0:
                            height = line['@HEIGHT']
                        if isinstance(words, list):
                            for word in words:
                                text += word['@CONTENT'] + ' '
                        else:
                            text += words['@CONTENT'] + ' '
                sent_text = sent_tokenize(text)
                engarr = []
                translation_text = ''
                for sent in sent_text:
                    print(sent)
                    engarr.append({'src': sent, 'id': 1})
                res = requests.post('http://52.40.71.62:3003/translator/translation_en', json=engarr)
                dictFromServer = res.json()
                if dictFromServer['response_body'] is not None:
                    for translation in dictFromServer['response_body']:
                        print(translation)
                        translation_text += translation['tgt'] + ' '
                    if word_count == 0:
                            word_count = math.ceil(len(translation_text.split(' '))/no_lines)
                    puttext(int(height),int(x),int(y),translation_text,o_filename, int(word_count), line_height)
            else:
                line_height = int(block['@HEIGHT'])
                if textline['String'] is not None:
                        words = textline['String']
                        height = textline['@HEIGHT']
                        if isinstance(words, list):
                            for word in words:
                                text += word['@CONTENT'] + ' '
                        else:
                            text += words['@CONTENT'] + ' '
                        word_count = len(text.split(' '))
                        engarr = []
                        print(text)
                        engarr.append({'src': text, 'id': 1})
                        res = requests.post('http://52.40.71.62:3003/translator/translation_en', json=engarr)
                        dictFromServer = res.json()
                        if dictFromServer['response_body'] is not None:
                            for translation in dictFromServer['response_body']:
                                print(translation)
                                puttext(int(height),int(x),int(y),translation['tgt'],o_filename, int(word_count), line_height)
        index+=1