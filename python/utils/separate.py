import codecs
import string
import re
import sys


def detect_language(str):
    wordList = re.sub("[^\w]", " ",  str).split()
    if len(wordList) == 0 or (len(wordList) ==1 and wordList[0].isdigit()) or len(str) < 10 or len(wordList) <3:
        return 'unknown'
    else:
        maxchar1 = max(wordList[0])
        maxchar2 = max(wordList[1])
        maxchar3 = max(wordList[2])
        if u'\u0900' <= maxchar1 <= u'\u097f' or u'\u0900' <= maxchar2 <= u'\u097f' or u'\u0900' <= maxchar3 <= u'\u097f':
            return 'hindi'
        else:
            return 'english'

def separate(basefilename):
    with codecs.open(basefilename+'.txt', encoding='utf-8') as f:
        input = f.readline()
        f_hin = open(basefilename+"_hin.txt", "w+")
        f_eng = open(basefilename+"_eng.txt", "w+")
        for i in f:
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
