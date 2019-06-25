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


def translatewithanuvada(fname, outputpath):
    try:
        with open(outputpath, 'w', encoding='utf-8') as f_eng:
            with codecs.open(fname, encoding='utf-8', errors='ignore') as f:
                flist = f.readlines()
                translatebigtext(f_eng, flist, 0)
                f_eng.close()
    except Exception as e:
        print(e)
        # print(translation)
        # f_eng.write(translation['translatedText'] + '\n')
        # for s in flist:


def translatebigtext(f_eng, flist, index):
    endCount = 20*index + 20
    callnext = True
    if (index+1)*20 > len(flist):
        endCount = 20*index + len(flist) % 20
        callnext = False
    # The text to translate
    # text = s
    # The target language
    # Translates some text into English
    hindilist = flist[20*index:endCount]
    hindiarr = []
    for hindi in hindilist:
        hindiarr.append({'src': hindi, 'id': 2})
    # print(hindiarr)
    res = requests.post('http://52.40.71.62:3003/translator/translation_hi', json=hindiarr)
    dictFromServer = res.json()
    print(dictFromServer['response_body'])
    if dictFromServer['response_body'] is not None:
        print(dictFromServer['response_body'])
        for translation in dictFromServer['response_body']:
            print(translation)
            # if len(translation['tgt']) > 0 and translation['tgt'] != '\n':
            f_eng.write(translation['tgt']+'\n')
    if callnext:
        index += 1
        translatebigtext(f_eng, flist, index)
    else:
        f_eng.close()
