from PIL import Image
import pytesseract
import argparse
import cv2
import os

def convertimagetotext(imagepaths, outputfilename, basename):
    words=[]
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
        conf_data = pytesseract.image_to_data(Image.open(
            filename), config='-l hin+eng --oem 1', output_type="dict")
        text = pytesseract.image_to_string(
            Image.open(filename), config='-l hin+eng --oem 1')
        f = open(outputfilename, "a+")
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
        # show the output images
        # cv2.imshow("Image", image)
        # cv2.imshow("Output", gray)
        # cv2.waitKey(0)
    return words



