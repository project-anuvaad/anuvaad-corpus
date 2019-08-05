"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
 
from pytesseract import pytesseract
import cv2
import uuid
from PIL import Image
import os

def convertimagetoalto(imagepaths, outputfilename, basename):
    words=[]
    file_index = 0
    for imagepath in imagepaths:
        image = cv2.imread(imagepath)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # make a check to see if median blurring should be done to remove
        # noise
        gray = cv2.medianBlur(gray, 3)

        # write the grayscale image to disk as a temporary file so we can
        # apply OCR to it
        filename = "{}.png".format(uuid.uuid1())
        cv2.imwrite(filename, gray)
        pytesseract.run_tesseract(
            filename,output_filename_base=outputfilename+'_'+str(file_index),lang='eng+hin+tam',extension='xml', config='alto --oem 1')
        conf_data = pytesseract.image_to_data(Image.open(
            filename), config='-l hin+eng+tam --oem 1', output_type="dict")
        index = 0
        file_index += 1
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
            word = {'imagepath':imagepath,'top':conf_data['top'][index],'left':conf_data['left'][index],'height':conf_data['height'][index],'text': conf_data['text'][index], 'conf': t,
                    'next': next_word, 'previous': previous_word, 'timestamp': basename}
            words.append(word)
            index = index + 1
        # show the output images
        # cv2.imshow("Image", image)
        # cv2.imshow("Output", gray)
        # cv2.waitKey(0)
    return words