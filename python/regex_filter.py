import re

input_ = 'sen.txt'
target = 'source_with_reg.txt'
EOF = False
with open(target, 'w') as target:
    with open(input_, 'r') as source:
        while not EOF:
            text = source.readline()
            if text == '':
                EOF = True
            else:

                res1 = re.search("x x+", text.lower())
                if res1 is not None:
                    res = re.search("[a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|y|z]", text.lower())
                    if res is not None:
                        target.write(text)
                else:
                    target.write(text)
    source.close()
    target.close()
