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

hindi = remove_newlines(sys.argv[1])
hindi_arr = hindi.split('।')
# print(hindi)
# sent_text = sent_tokenize(hindi)
f_hin = open(sys.argv[2]+"_hin.txt", "w+")

for i in hindi_arr:
    hindi_arr_second = i.split('?')
    for t in hindi_arr_second:
        hindi_arr_third = t.split('|')
        for k in hindi_arr_third:
            f_hin.write(k.strip() + '\n')
