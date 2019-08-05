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
        print(imagepath)
        filename = imagepath
        o_filename = imagepath
        f_alto = open(altobase+'_'+str(index)+'.xml', "r")
        output = cv2.imread(filename)
        data = xmltodict.parse(f_alto.read())
        f_alto.close()
        block_array = []
        blocks = data['alto']['Layout']['Page']['PrintSpace']['TextBlock']
        if not isinstance(blocks, list):
            block_array.append(blocks)
        else:
            block_array = blocks
        sentences = ''
        for block in block_array:
            previous_x = -1
            previous_y = -1
            textline = block['TextLine']
            if isinstance(textline, list):
                for line in textline:
                    if line['String'] is not None:
                        words = line['String']
                        if isinstance(words, list):
                            for word in words:
                                if previous_x != -1 and previous_y != -1:
                                    if abs(previous_y-int(word['@VPOS'])) > 4*int(word['@HEIGHT']) or (abs(previous_y-int(word['@VPOS'])) < int(word['@HEIGHT']) and abs(previous_x-int(word['@HPOS'])) > 2*int(word['@WIDTH'])):
                                        if texttype == '_hin':
                                            tokenizehin(sentences, f)
                                        else:
                                            tokenizeeng(sentences, f)
                                        sentences = ''
                                sentences+=word['@CONTENT']+' '
                                previous_x = int(word['@HPOS']) + int(word['@WIDTH'])
                                previous_y = int(word['@VPOS'])
                        else:
                            if len(words['@CONTENT'].strip()) > 0:
                                if previous_x != -1 and previous_y != -1:
                                    if abs(previous_y-int(words['@VPOS'])) > 4*int(words['@HEIGHT']) or (abs(previous_y-int(words['@VPOS'])) < int(words['@HEIGHT']) and abs(previous_x-int(words['@HPOS'])) > 2*int(words['@WIDTH'])):
                                        if texttype == '_hin':
                                            tokenizehin(sentences, f)
                                        else:
                                            tokenizeeng(sentences, f)
                                        sentences = ''
                                sentences+=words['@CONTENT']+' '
                                previous_x = int(words['@HPOS']) + int(words['@WIDTH'])
                                previous_y = int(words['@VPOS'])
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
                            single_word = False
                            if previous_x != -1 and previous_y != -1:
                                if abs(previous_y-int(word['@VPOS'])) > 4*int(word['@HEIGHT']) or (abs(previous_y-int(word['@VPOS'])) < int(word['@HEIGHT']) and abs(previous_x-int(word['@HPOS'])) > 2*int(word['@WIDTH'])):
                                    if texttype == '_hin':
                                        tokenizehin(sentences, f)
                                    else:
                                        tokenizeeng(sentences, f)
                                    sentences = ''
                            sentences+=word['@CONTENT']+' '
                            previous_x = int(word['@HPOS']) + int(word['@WIDTH'])
                            previous_y = int(word['@VPOS'])
                    else:
                        if len(words['@CONTENT'].strip()) > 0:
                            single_word = False
                            if previous_x != -1 and previous_y != -1:
                                if abs(previous_y-int(words['@VPOS'])) > 4*int(words['@HEIGHT']) or (abs(previous_y-int(words['@VPOS'])) < int(words['@HEIGHT']) and abs(previous_x-int(words['@HPOS'])) > 2*int(words['@WIDTH'])):
                                    if texttype == '_hin':
                                        tokenizehin(sentences, f)
                                    else:
                                        tokenizeeng(sentences, f)
                                    sentences = ''
                            sentences+=words['@CONTENT']+' '
                            previous_x = int(words['@HPOS']) + int(words['@WIDTH'])
                            previous_y = int(words['@VPOS'])
            # if texttype == '_hin':
            #     tokenizehin(sentences, f)
            # else:
            #     tokenizeeng(sentences, f)
            # f.write(sentences+'\n')
        index+=1
        if texttype == '_hin':
            tokenizehin(sentences, f)
        else:
            tokenizeeng(sentences, f)
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
    print(sentence)
    sent_text = sent_tokenize(sentence)
    print(sent_text)
    for i in sent_text:
        f.write(i.strip() + '\n')