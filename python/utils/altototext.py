from PIL import Image
from nltk.tokenize import sent_tokenize
from pytesseract import pytesseract
import argparse
import xmltodict
import json
import cv2
import os
import math

def altototext(imagepaths, altobase, texttype):
    index = 0
    f = open(altobase+'.txt', "a+")
    for imagepath in imagepaths:
        filename = imagepath
        o_filename = imagepath
        f_alto = open(altobase+'_'+str(index)+'.xml', "r")
        output = cv2.imread(filename)
        data = xmltodict.parse(f_alto.read())
        f_alto.close()
        blocks = data['alto']['Layout']['Page']['PrintSpace']['TextBlock']
        for block in blocks:
            sentences = ''
            textline = block['TextLine']
            if isinstance(textline, list):
                for line in textline:
                    if line['String'] is not None:
                        words = line['String']
                        if isinstance(words, list):
                            for word in words:
                                sentences+=word['@CONTENT']+' '
                        else:
                            if len(words['@CONTENT'].strip()) > 0:
                                sentences+=words['@CONTENT']+' '
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
                            sentences+=word['@CONTENT']+' '
                    else:
                        if len(words['@CONTENT'].strip()) > 0:
                            sentences+=words['@CONTENT']+' '
            if texttype == '_hin':
                tokenizehin(sentences, f)
            else:
                tokenizeeng(sentences, f)
            # f.write(sentences+'\n')
        index+=1
    f.close()

def tokenizehin(sentence, f):
    hindi_arr_second = sentence.split('?')
    for t in hindi_arr_second:
        hindi_arr_third = t.split('|')
        for k in hindi_arr_third:
            words = k.strip()
            if len(words) > 0:
                f.write(k.strip() + '\n')

def tokenizeeng(sentence, f):
    sent_text = sent_tokenize(sentence)
    for i in sent_text:
        f.write(i.strip() + '\n')