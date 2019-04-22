import codecs
import string
import re
import sys
from nltk import tokenize


def detect_language(str):
    wordList = re.sub("[^\w]", " ",  str).split()
    if len(str) < 10 or len(wordList) <6:
        return 'unknown'
    else:
        maxchar1 = max(wordList[1])
        maxchar2 = max(wordList[2])
        maxchar3 = max(wordList[3])
        if u'\u0900' <= maxchar1 <= u'\u097f' or u'\u0900' <= maxchar2 <= u'\u097f' or u'\u0900' <= maxchar3 <= u'\u097f':
            return 'hindi'
        else:
            return 'english'


with codecs.open(sys.argv[1], encoding='utf-8') as f:
    input = f.readline()
    sentences = tokenize.sent_tokenize(input)
    f_hin = open(sys.argv[2]+"_hin.txt", "w+")
    f_eng = open(sys.argv[2]+"_eng.txt", "w+")
    for i in sentences:
        isEng = detect_language(i)
        if isEng == "hindi":
            f_hin.write(i)
            # Hindi Character
            # add this to another file
            # print(i,end="\t")
        if isEng == "english":
            f_eng.write(i)
            # Hindi Character
            # add this to another file
            # print(i,end="\t")
    f_hin.close()
    f_eng.close()
