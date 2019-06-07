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
def processenglish(filepath):
    english = remove_newlines(filepath)
    sent_text = sent_tokenize(english)
    f_eng = open(filepath, "w+")

    for i in sent_text:
        f_eng.write(i.strip() + '\n')
