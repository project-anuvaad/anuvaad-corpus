"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
 
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

def filtertext(filename, filename_filtered):
    with codecs.open(filename, encoding='utf-8') as f:
        input = f.readline()
        f_data = open(filename_filtered, "w+")
        for i in f:
            isNumber = check_page_number(i)
            if isNumber == "str":
                f_data.write(i)
        f_data.close()
        f.close()
