"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
# Imports the Google Cloud client library
from google.cloud import translate
import codecs
import sys

# Instantiates a client

BATCH_SIZE = 100
RECURSION_LIMIT = 10000
sys.setrecursionlimit(RECURSION_LIMIT)

def translatewithgoogle(fname, outputpath, target='en'):
    try:
        with open(outputpath, 'w', encoding='utf-8') as f_eng:
            with codecs.open(fname, encoding='utf-8', errors='ignore') as f:
                flist = f.readlines()
                translate_client = translate.Client()
                translatebigtext(f_eng, flist, translate_client, 0, target)
                f_eng.close()
    except Exception as e:
        print(e)
        # print(translation)
        # f_eng.write(translation['translatedText'] + '\n')
        # for s in flist:

def translatesinglesentence(sentence, target='en'):
    # target = 'en'
    translate_client = translate.Client()
    translation_list = []
    # Translates some text into English
    translationarray = translate_client.translate(
        sentence,
        target_language=target)
    for translation in translationarray:
        translation_list.append(translation['translatedText'])
    return translation_list


def translatebigtext(f_eng, flist, translate_client, index, target):
    global BATCH_SIZE
    endCount = BATCH_SIZE*index + BATCH_SIZE
    callnext = True
    if (index+1)*BATCH_SIZE > len(flist):
        endCount = BATCH_SIZE*index + len(flist) % BATCH_SIZE
        callnext = False
    # The text to translate
    # text = s
    # The target language
    # target = 'en'

    # Translates some text into English
    translationarray = translate_client.translate(
        flist[BATCH_SIZE*index:endCount],
        target_language=target)
    for translation in translationarray:
        if len(translation['translatedText']) > 0:
            f_eng.write(translation['translatedText'].replace("\n", "") + '\n')
        else:
            f_eng.write('' + '\n')
    if callnext:
        index += 1
        translatebigtext(f_eng, flist, translate_client, index, target)
    else:
        f_eng.close()
