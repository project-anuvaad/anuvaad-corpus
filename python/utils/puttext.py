import numpy as np
from PIL import ImageFont, ImageDraw, Image
import textwrap
import cv2

# Create a black image

# Write some Text
def puttext(height, x, y, text, filename):
    print(filename)
    lines = textwrap.wrap(text, width=90)
    font                   = cv2.FONT_HERSHEY_SIMPLEX
    bottomLeftCornerOfText = (x,y)
    fontScale              = 1
    fontColor              = (0,0,0)
    lineType               = 2
    b,g,r,a = 0,0,0,0
    img = cv2.imread(filename)
    fontpath = "utils/Lohit-Devanagari.ttf" 
    font = ImageFont.truetype(fontpath, height)
    img_pil = Image.fromarray(img)
    draw = ImageDraw.Draw(img_pil)
    y_text = y
    text_w = x
    for line in lines:
        width, height = font.getsize(line)
        draw.text((x, y_text), line, font=font, fill=(b,g,r,a))
        text_w, text_h = draw.textsize(line, font)
        y_text += height
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