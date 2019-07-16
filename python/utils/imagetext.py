from PIL import Image
from pytesseract import pytesseract
import argparse
import xmltodict
import json
import cv2
import os
import requests
from puttext import puttext
from nltk.tokenize import sent_tokenize
import math

filename = '../upload/table1.png'
o_filename = '../upload/table2.png'
conf_data = pytesseract.run_tesseract(
            filename,output_filename_base='test',lang='eng+hin',extension='xml', config='alto --oem 1')
f_hin = open("test.xml", "r")
# print(xmltodict.parse(f_hin.read()))
data = xmltodict.parse(f_hin.read())
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
    previous_position = 0
    previous_position_x = 0
    previous_position_y = 0
    if isinstance(textline, list):
        no_lines = len(textline)
        print(no_lines)
        # if line_height == 0:
        line_height = int(block['@HEIGHT']) / len(textline)
        for line in textline:
            if line['String'] is not None:
                words = line['String']
                if height == 0:
                    height = line['@HEIGHT']
                if isinstance(words, list):
                    for word in words:
                        if previous_position == 0:
                            previous_position = int(word['@HPOS']) + int(word['@WIDTH'])
                            previous_position_x = int(word['@HPOS'])
                            previous_position_y = int(word['@VPOS'])
                            text += word['@CONTENT'] + ' '
                        else:
                            print('diff'+str(int(word['@HPOS']) -  previous_position))
                            if abs(int(word['@HPOS']) -  previous_position) > 10 and abs(previous_position_y - int(word['@VPOS'])) < int(word['@HEIGHT']):
                                engarr = []
                                translation_text = ''
                                # if word_count == 0:
                                sent_text = sent_tokenize(text)
                                for sent in sent_text:
                                    engarr.append({'src': sent, 'id': 1})
                                res = requests.post('http://52.40.71.62:3003/translator/translation_en', json=engarr)
                                dictFromServer = res.json()
                                if dictFromServer['response_body'] is not None:
                                    for translation in dictFromServer['response_body']:
                                        # print(translation)
                                        translation_text += translation['tgt'] + ' '
                                    puttext(int(height),previous_position_x,previous_position_y,translation_text,o_filename, len(translation_text.split(' ')), line_height)
                                text = word['@CONTENT']
                            else:
                                text += word['@CONTENT'] + ' '
                            previous_position = int(word['@HPOS']) + int(word['@WIDTH'])
                            previous_position_y = int(word['@VPOS'])
                            previous_position_x = int(word['@HPOS'])
                else:
                    text += words['@CONTENT'] + ' '
                    # previous_position = int(words['@HPOS']) +int(words['@WIDTH'])
                    # previous_position_y = int(words['@VPOS'])
                    # previous_position_x = int(words['@HPOS'])
        sent_text = sent_tokenize(text)
        engarr = []
        translation_text = ''
        # if word_count == 0:
        for sent in sent_text:
            engarr.append({'src': sent, 'id': 1})
            # translation_text += sent + ' '
            # print(sent)
        # print(len(translation_text.split(' ')))
        # word_count = math.ceil(len(translation_text.split(' '))/no_lines)
        # # print(word_count)
        # puttext(int(height),int(x),int(y),translation_text,'../upload/1562311529_hin_0.jpg', int(word_count), line_height)
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
        # if line_height == 0:
        line_height = int(block['@HEIGHT'])
        if textline['String'] is not None:
                words = textline['String']
                # if height == 0:
                height = textline['@HEIGHT']
                # if word_count == 0:
                
                if isinstance(words, list):
                    for word in words:
                        text += word['@CONTENT'] + ' '
                        # previous_position = int(word['@HPOS']) + int(word['@WIDTH'])
                        # previous_position_y = int(word['@VPOS'])
                        # previous_position_x = int(word['@HPOS'])
                else:
                    text += words['@CONTENT'] + ' '
                    # previous_position = int(words['@HPOS']) + int(words['@WIDTH'])
                    # previous_position_y = int(words['@VPOS'])
                    # previous_position_x = int(words['@HPOS'])
                word_count = len(text.split(' '))
                # print('1')
                # print(text)
                # puttext(int(height),int(x),int(y),text,'../upload/1562311529_hin_0.jpg', int(word_count), line_height)
                engarr = []
                engarr.append({'src': text, 'id': 1})
                res = requests.post('http://52.40.71.62:3003/translator/translation_en', json=engarr)
                dictFromServer = res.json()
                if dictFromServer['response_body'] is not None:
                    for translation in dictFromServer['response_body']:
                        print(translation)
                        puttext(int(height),int(x),int(y),translation['tgt'],o_filename, int(word_count), line_height)