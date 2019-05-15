import codecs
import string
import re
import sys


def check_page_number(str):
    wordList = re.sub("[^\w]", " ",  str).split()
    if len(wordList) == 0 or (len(wordList) ==1 and wordList[0].isdigit()):
        return 'number'
    else:
        return 'str'


with codecs.open(sys.argv[1], encoding='utf-8') as f:
    input = f.readline()
    f_data = open(sys.argv[2]+"_filtered.txt", "w+")
    for i in f:
        isNumber = check_page_number(i)
        if isNumber == "str":
            f_data.write(i)
    f_data.close()
