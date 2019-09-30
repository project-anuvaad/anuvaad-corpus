# """
#  * @author ['aroop']
#  * @email ['aroop.ghosh@tarento.com']
#  * @create date 2019-06-25 12:40:01
#  * @modify date 2019-06-25 12:40:01
#  * @desc [description]
#  """
#
# from PIL import Image
# import pytesseract
# import argparse
# import cv2
# import os
# # import multiprocessing as mp
# from multiprocessing.dummy import Pool as ThreadPool
# import threading
# import random
# import string
# import time

#
# global_lock = threading.Lock()
# # from utils.processimage import processimage
# words = []
# image_text = []
# # print(mp.cpu_count())
# # pool = mp.Pool(mp.cpu_count())
#
def processimage(imagepath,outputfilename, basename):
    # print(imagepath)
    # global global_lock
    # global image_text
    # while global_lock.locked():
    #     continue
    #
    # global_lock.acquire()
    # word_arr = []
    # image = cv2.imread(imagepath)
    # gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    #
    # # make a check to see if median blurring should be done to remove
    # # noise
    # gray = cv2.medianBlur(gray, 3)
    #
    # # write the grayscale image to disk as a temporary file so we can
    # # apply OCR to it
    # filename = "{}.png".format(randomString(10))
    # cv2.imwrite(filename, gray)
    # conf_data = pytesseract.image_to_data(Image.open(
    #     filename), config='-l hin+eng --oem 1', output_type="dict")
    # text = pytesseract.image_to_string(
    #     Image.open(filename), config='-l hin+eng --oem 1')
    # image_text.append(text)
    # index = 0
    # os.remove(filename)
    # for t in conf_data['conf']:
    #         next_word = ''
    #         previous_word = ''
    #         if index is not 0:
    #             previous_word = conf_data['text'][index-1]
    #         if index < (len(conf_data['conf']) - 1):
    #             try:
    #                 next_word = conf_data['text'][index+1]
    #             except Exception as e:
    #                 print(e)
    #         word = {'text': conf_data['text'][index], 'conf': t,
    #                 'next': next_word, 'previous': previous_word, 'timestamp': basename}
    #         word_arr.append(word)
    #         index = index + 1
    # global words
    # words = words + word_arr
    # global_lock.release()
    return ""



def randomString(stringLength=10):
    """Generate a random string of fixed length """
    # letters = string.ascii_lowercase
    # return str(int(time.time()))+''.join(random.choice(letters) for i in range(stringLength))
    return ""


def convertimagetotext(imagepaths, outputfilename, basename, threads=2):
    # threads = []
    # # pool = ThreadPool(processes=len(imagepaths))
    # for imagepath in imagepaths:
    #     # results = pool.map(processimage, imagepath, outputfilename, basename)
    #     # capturewords(results)
    #     # pool.apply_async(processimage, args=(
    #     #     imagepath, outputfilename, basename), callback=capturewords)
    #     t = threading.Thread(target=processimage,args=[imagepath, outputfilename, basename])
    #     threads.append(t)
    #     t.start()
    # [thread.join() for thread in threads]
    # # pool.close()
    # # pool.join()
    # global words
    # global image_text
    # f = open(os.getcwd() + '/' + outputfilename, "a+")
    # for text in image_text:
    #     f.write(text)
    # f.close()
    # return words
    return ""


def capturewords(word):
    global words
    words = words+word
