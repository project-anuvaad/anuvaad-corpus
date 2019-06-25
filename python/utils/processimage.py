"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
 
from PIL import Image
import pytesseract
import argparse
import cv2
import os
import random
import string
import time


def processimage(imagepath,outputfilename, basename):
    words = []
    image = cv2.imread(imagepath)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # make a check to see if median blurring should be done to remove
    # noise
    gray = cv2.medianBlur(gray, 3)

    # write the grayscale image to disk as a temporary file so we can
    # apply OCR to it
    filename = "{}.png".format(randomString(10))
    cv2.imwrite(filename, gray)
    conf_data = pytesseract.image_to_data(Image.open(
        filename), config='-l hin+eng --oem 1', output_type="dict")
    text = pytesseract.image_to_string(
        Image.open(filename), config='-l hin+eng --oem 1')
    f = open(os.getcwd() + '/' + outputfilename, "a+")
    f.write(text)
    f.close()
    index = 0
    os.remove(filename)
    for t in conf_data['conf']:
            next_word = ''
            previous_word = ''
            if index is not 0:
                previous_word = conf_data['text'][index-1]
            if index < (len(conf_data['conf']) - 1):
                try:
                    next_word = conf_data['text'][index+1]
                except Exception as e:
                    print(e)
            word = {'text': conf_data['text'][index], 'conf': t,
                    'next': next_word, 'previous': previous_word, 'timestamp': basename}
            words.append(word)
            index = index + 1
    return words



def randomString(stringLength=10):
    """Generate a random string of fixed length """
    letters = string.ascii_lowercase
    return str(int(time.time()))+''.join(random.choice(letters) for i in range(stringLength))
