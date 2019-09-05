EOF = False
filename = 'source_with_reg.txt'
output = 'corpus.txt'
data = set()
init_count = 0
try:
    with open(filename, 'r', encoding='utf-8') as source:
        while not EOF:
            text = source.readline()
            if text == '' and source.readline() == '':
                EOF = True
                break
            else:
                data.add(text)
                init_count = init_count + 1
        source.close()
except Exception as e:
    print("ERROR OCCURRED WHILE READING FILE")

with open(output, 'w', encoding='utf-8') as target:
    for text in data:
        target.write(text)
    target.close()

print(init_count - data.__len__())