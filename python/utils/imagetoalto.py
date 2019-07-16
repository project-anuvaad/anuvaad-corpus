"""
 * @author ['aroop']
 * @email ['aroop.ghosh@tarento.com']
 * @create date 2019-06-25 12:40:01
 * @modify date 2019-06-25 12:40:01
 * @desc [description]
 """
 
from pytesseract import pytesseract

def convertimagetoalto(imagepaths, outputfilename, basename):
    index = 0
    for imagepath in imagepaths:
        conf_data = pytesseract.run_tesseract(
            imagepath,output_filename_base=outputfilename+'_'+str(index),lang='eng+hin',extension='xml', config='alto --oem 1')
        index+=1