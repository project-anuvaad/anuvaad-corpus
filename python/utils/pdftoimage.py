from pdf2image import convert_from_path


def converttoimage(filepath, name, basename):
    try:
        pages = convert_from_path(filepath, 500)
    except Exception as e: 
        print(e)
    count = 0
    imagenames = []
    for page in pages:
        page.save(name+'_'+str(count)+'.jpg', 'JPEG')
        imagenames.append(name+'_'+str(count)+'.jpg')
        count = count+1
    return {'imagenames': imagenames, 'basename': basename}
