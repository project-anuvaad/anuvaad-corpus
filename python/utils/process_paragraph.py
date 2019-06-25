"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
 
from nltk.tokenize import sent_tokenize
import sys
import codecs
import string
import re


def remove_newlines(fname):
    with codecs.open(fname, encoding='utf-8',errors='ignore') as f:
        flist = f.readlines()
        str = ''
        for s in flist:
            if s=='\n':
                if not str.endswith(' '):
                    str+=s.replace('\n', ' ')
            else:
                str+=s.replace('\n', ' ')
        return str

def processhindi(filepath):
    hindi = remove_newlines(filepath)
    hindi_arr = hindi.split('।')
    # print(hindi)
    # sent_text = sent_tokenize(hindi)
    f_hin = open(filepath, "w+")

    for i in hindi_arr:
        hindi_arr_second = i.split('?')
        for t in hindi_arr_second:
            hindi_arr_third = t.split('|')
            for k in hindi_arr_third:
                words = k.strip()
                if len(words) > 0:
                    f_hin.write(k.strip() + '\n')
    f_hin.close()


