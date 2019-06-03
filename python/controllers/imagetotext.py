from PIL import Image
import pytesseract
import argparse
import cv2
import os
from flask import jsonify


def convertimagetotext(imagepaths):
    words = []
    for imagepath in imagepaths:
        image = cv2.imread(imagepath)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # make a check to see if median blurring should be done to remove
        # noise
        gray = cv2.medianBlur(gray, 3)
        
        # write the grayscale image to disk as a temporary file so we can
        # apply OCR to it
        filename = "{}.png".format(os.getpid())
        cv2.imwrite(filename, gray)
        text = pytesseract.image_to_data(Image.open(filename),lang = 'hin+eng', output_type="dict")
        index = 0
        os.remove(filename)
        for t in text['conf']:
            word = {'text':text['text'][index], 'conf':t}
            words.append(word)
            index = index + 1
        
        
        # show the output images
        # cv2.imshow("Image", image)
        # cv2.imshow("Output", gray)
        # cv2.waitKey(0)
    return words