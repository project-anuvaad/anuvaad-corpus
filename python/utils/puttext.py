import numpy as np
from PIL import ImageFont, ImageDraw, Image
import textwrap
import cv2
import math
import re



def detect_language(str):
    wordList = re.sub("[^\w]", " ",  str).split()
    if len(wordList) == 0:
        return 'unknown'
    else:
        maxchar1 = max(wordList[0])
        if u'\u0900' <= maxchar1 <= u'\u097f':
            return 'hindi'
        else:
            return 'english'
# Create a black image

# Write some Text
def puttext(height, x, y, text, filename, word_count, line_height):
    words = text.split(' ')
    dif = line_height - height
    lines = math.ceil(len(words) / word_count)
    font                   = cv2.FONT_HERSHEY_SIMPLEX
    bottomLeftCornerOfText = (x,y)
    fontScale              = 1
    fontColor              = (0,0,0)
    lineType               = 2
    b,g,r,a = 0,0,0,0
    img = cv2.imread(filename)
    # fontpath = "Roboto-Regular.ttf" 
    # if detect_language(text) == 'hindi':
    fontpath = "utils/NotoSans-Regular.ttf" 
    # fontpath = "Roboto-Regular.ttf" 
    font = ImageFont.truetype(fontpath, height)
    img_pil = Image.fromarray(img)
    draw = ImageDraw.Draw(img_pil)
    y_text = y
    text_w = x
    for i in range(1,lines+1):
        t = " "
        if i != lines:
            t = " ".join(words[word_count*(i-1):word_count*(i)])
        else:
            t = " ".join(words[word_count*(i-1):len(words)])
        draw.text((x, y_text), t, font=font, fill=(b,g,r,a))
        text_w, text_h = draw.textsize(t, font)
        y_text += height+dif
    # draw.text((x, y),  text, font = font, fill = (b,g,r,a))
    img = np.array(img_pil)
    # cv2.putText(img,text, 
    #     bottomLeftCornerOfText, 
    #     font, 
    #     fontScale,
    #     fontColor,
    #     lineType)

    #Display the image
    # cv2.imshow("img",img)

    #Save image
    cv2.imwrite(filename, img)
    return (text_w, y_text)
    # cv2.waitKey(0)