# Imports the Google Cloud client library
from google.cloud import translate
import codecs

# Instantiates a client


def translatewithgoogle(fname, outputpath):
    try:
        with open(outputpath, 'w', encoding='utf-8') as f_eng:
            with codecs.open(fname, encoding='utf-8', errors='ignore') as f:
                flist = f.readlines()
                translate_client = translate.Client()
                translatebigtext(f_eng, flist, translate_client, 0)
                f_eng.close()
    except Exception as e:
        print(e)
        # print(translation)
        # f_eng.write(translation['translatedText'] + '\n')
        # for s in flist:


def translatebigtext(f_eng, flist, translate_client, index):
    endCount = 20*index + 20
    callnext = True
    if (index+1)*20 > len(flist):
        endCount = 20*index + len(flist) % 20
        callnext = False
    # The text to translate
    # text = s
    # The target language
    target = 'en'

    # Translates some text into English
    translationarray = translate_client.translate(
        flist[20*index:endCount],
        target_language=target)
    for translation in translationarray:
        if len(translation['translatedText']) > 0 and translation['translatedText'] != '\n':
            f_eng.write(translation['translatedText'].replace("\n", "") + '\n')
    if callnext:
        index += 1
        translatebigtext(f_eng, flist, translate_client, index)
    else:
        f_eng.close()
