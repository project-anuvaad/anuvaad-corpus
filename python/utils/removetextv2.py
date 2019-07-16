from PIL import Image
from pytesseract import pytesseract
import argparse
import xmltodict
import json
import cv2
import os
import math


def removetext(imagepaths, altobase):
    index = 0
    for imagepath in imagepaths:
        filename = imagepath
        o_filename = imagepath
        f_alto = open(altobase+'_'+str(index)+'.xml', "r")
        output = cv2.imread(filename)
        data = xmltodict.parse(f_alto.read())
        f_alto.close()
        blocks = data['alto']['Layout']['Page']['PrintSpace']['TextBlock']
        for block in blocks:
            textline = block['TextLine']
            if isinstance(textline, list):
                for line in textline:
                    if line['String'] is not None:
                        words = line['String']
                        if isinstance(words, list):
                            for word in words:
                                cv2.rectangle(output, (int(word['@HPOS']), int(word['@VPOS'])), (int(
                                    word['@HPOS'])+int(word['@WIDTH']), int(word['@VPOS'])+int(word['@HEIGHT'])), (255, 255, 255), -1)
                        else:
                            if len(words['@CONTENT'].strip()) > 0:
                                cv2.rectangle(output, (int(words['@HPOS']), int(words['@VPOS'])), (int(
                                    words['@HPOS'])+int(words['@WIDTH']), int(words['@VPOS'])+int(words['@HEIGHT'])), (255, 255, 255), -1)
                                print(str(words['@CONTENT']))
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
                            cv2.rectangle(output, (int(word['@HPOS']), int(word['@VPOS'])), (int(
                                word['@HPOS'])+int(word['@WIDTH']), int(word['@VPOS'])+int(word['@HEIGHT'])), (255, 255, 255), -1)
                    else:
                        if len(words['@CONTENT'].strip()) > 0:
                            cv2.rectangle(output, (int(words['@HPOS']), int(words['@VPOS'])), (int(
                                words['@HPOS'])+int(words['@WIDTH']), int(words['@VPOS'])+int(words['@HEIGHT'])), (255, 255, 255), -1)
                            print(str(words['@CONTENT']))
        cv2.imwrite(o_filename, output)
        index+=1
