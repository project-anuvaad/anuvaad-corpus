"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
import codecs
import requests

# Instantiates a client

BATCH_SIZE = 20

def translatewithanuvadaeng(fname, outputpath, model_id):
    try:
        with open(outputpath, 'w', encoding='utf-8') as f_eng:
            with codecs.open(fname, encoding='utf-8', errors='ignore') as f:
                flist = f.readlines()
                translatebigtext(f_eng, flist, 0, model_id)
                f_eng.close()
    except Exception as e:
        print(e)
        # print(translation)
        # f_eng.write(translation['translatedText'] + '\n')
        # for s in flist:


def translatebigtext(f_eng, flist, index, model_id):
    global BATCH_SIZE
    endCount = BATCH_SIZE*index + BATCH_SIZE
    callnext = True
    print(len(flist))
    if (index+1)*BATCH_SIZE > len(flist):
        endCount = BATCH_SIZE*index + len(flist) % BATCH_SIZE
        callnext = False
    # The text to translate
    # text = s
    # The target language
    # Translates some text into English
    print(endCount)
    englist = flist[BATCH_SIZE*index:endCount]
    engarr = []
    for eng in englist:
        engarr.append({'src': eng, 'id': int(model_id)})
    # print(hindiarr)
    res = requests.post('http://52.40.71.62:3003/translator/translation_en', json=engarr)
    dictFromServer = res.json()
    print(dictFromServer)
    if dictFromServer and 'response_body' in dictFromServer and dictFromServer['response_body'] is not None:
        print(dictFromServer['response_body'])
        for translation in dictFromServer['response_body']:
            print(translation)
            if len(translation['tgt']) > 0:
                f_eng.write(translation['tgt'].replace("\n","")+'\n')
            else:
                f_eng.write(translation['tgt']+'\n')
    else:
        for i in range(0,endCount):
            f_eng.write('\n')
    if callnext:
        index += 1
        translatebigtext(f_eng, flist, index, model_id)
    else:
        f_eng.close()
