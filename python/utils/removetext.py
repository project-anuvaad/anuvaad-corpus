# import cv2
# import numpy as np
# from PIL import ImageFont, ImageDraw, Image

# # img = cv2.imread('1561625887_eng_2.jpg')
# # cv2.threshold(img, 210, 255, cv2.THRESH_BINARY)[1][:,:,0]
# # dst = cv2.inpaint(img, mask, 7, cv2.INPAINT_NS)
# # cv2.imwrite('../upload/test.png', dst)
# image_src = cv2.imread('../upload/1561625887_hin_1.jpg')
# cv2_im_rgb = cv2.cvtColor(image_src, cv2.COLOR_BGR2RGB)
# pil_im = Image.fromarray(cv2_im_rgb)
# draw = ImageDraw.Draw(pil_im)


import csv
import cv2
import numpy as np
from pytesseract import pytesseract as pt, Output
import statistics

# processing letter by letter boxing


def process_letter(thresh, output):
    # assign the kernel size
    kernel = np.ones((2, 1), np.uint8)  # vertical
    # use closing morph operation then erode to narrow the image
    temp_img = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=3)
    # temp_img = cv2.erode(thresh,kernel,iterations=2)
    letter_img = cv2.erode(temp_img, kernel, iterations=1)

    # find contours
    (contours, _) = cv2.findContours(letter_img.copy(),
                                     cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # loop in all the contour areas
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        cv2.rectangle(output, (x-1, y-5), (x+w, y+h), (255, 255, 255), -1)

    return output


def process_word(thresh, output):
    # assign 2 rectangle kernel size 1 vertical and the other will be horizontal
    kernel = np.ones((2, 1), np.uint8)
    kernel2 = np.ones((1, 4), np.uint8)
    # use closing morph operation but fewer iterations than the letter then erode to narrow the image
    temp_img = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    #temp_img = cv2.erode(thresh,kernel,iterations=2)
    word_img = cv2.dilate(temp_img, kernel2, iterations=1)

    (contours, _) = cv2.findContours(word_img.copy(),
                                     cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        cv2.rectangle(output, (x-1, y-5), (x+w, y+h), (255, 255, 255), -1)
    return output

filename = '../upload/1562311529_hin_0.jpg'
img = cv2.imread(filename)
output3_word = img.copy()
gray1 = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

ret1, th1 = cv2.threshold(gray1, 0, 255, cv2.THRESH_BINARY_INV+cv2.THRESH_OTSU)
output3_word = process_word(th1, output3_word)
# config = ("-l eng+hin --oem 1 --psm 7")
# # text = pytesseract.image_to_string(roi, config=config)
# d = pt.image_to_data(img, output_type=Output.DICT,lang='hin+eng')
# print(d)
# n_boxes = len(d['level'])
# heights = []
# widths = []
# for i in range(n_boxes):
#     (x, y, w, h) = (d['left'][i], d['top'][i], d['width'][i], d['height'][i])
#     heights.append(h)
#     widths.append(w)
# heights.sort()
# for i in range(n_boxes):
#     (x, y, w, h, conf, text) = (d['left'][i], d['top'][i], d['width'][i], d['height'][i], d['conf'][i], d['text'][i])
# #     print(statistics.median(heights))
# #     print(min(heights))
#     if int(conf)> 20 and len(text.strip()) > 0 and (h <=statistics.median(heights)+4 or h <=statistics.mean(heights)):
#         cv2.rectangle(img, (x, y), (x + w, y + h), (255, 255, 255), thickness=-1)

# cv2.imshow('img', img)
cv2.imwrite(filename, output3_word)
# img.save('new_pic.jpg')
# cv2.waitKey(0)


# # Choose a font
# font = ImageFont.truetype("Roboto-Regular.ttf", 50)

# # Draw the text
# draw.text((1798, 889), "Your Text Here",fill='Black', font=font)

# # Save the image
# cv2_im_processed = cv2.cvtColor(np.array(pil_im), cv2.COLOR_RGB2BGR)

# data = np.array(image_src)
# gray = cv2.cvtColor(image_src, cv2.COLOR_BGRA2GRAY)

#         # make a check to see if median blurring should be done to remove
#         # noise
# gray = cv2.medianBlur(gray, 3)
# # gray[np.where((image_src==[0,0,0]).all(axis=2))] = [255,255,255]
# converted = np.where(data == 255, 255, 0)

# img = Image.fromarray(converted.astype('uint8'))
# img.save('new_pic.jpg')

# font = cv2.FONT_HERSHEY_SIMPLEX
# cv2.putText(image_src, 'Christmas', (598,689), font, 3, (0, 255, 0), 2, cv2.LINE_AA)
# cv2.imwrite('pillar_text.jpg', cv2_im_processed)
# removed = cv2.add(image_src, mask)

# result = cv2.fastNlMeansDenoisingColored(img,None,20,10,7,21)
# gray_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
# _, thresh = cv2.threshold(gray_img, 500, 455, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
# img_contours = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)[-2]
# img_contours = sorted(img_contours, key=cv2.contourArea)

# for i in img_contours:
#     if cv2.contourArea(i) > 100:
#         break
# mask = np.zeros(img.shape[:2], np.uint8)
# cv2.drawContours(mask, [i],-1, 255, -1)
# new_img = cv2.bitwise_and(img, img, mask=mask)
# cv2.imshow("Original Image", img)
# cv2.imshow("Image with background removed", new_img)

# cv2.waitKey(0)

# cv2.imwrite('text2.jpg', gray)
# fgbg = cv2.createBackgroundSubtractorMOG2()
# mask = fgbg.apply(img)
# # dst = cv2.inpaint(img, mask, 7, cv2.INPAINT_NS)

# cv2.imshow('frame',mask)
# cv2.waitKey(0)
# cv2.destroyAllWindows()

# img = cv2.imread('../upload/1561625887_eng_2.jpg')
# mask = np.zeros(img.shape[:2], np.uint8)
# bgdModel = np.zeros((1, 65), np.float64)
# fgdModel = np.zeros((1, 65), np.float64)
# rect = (161, 79, 150, 150)
# mask2 = np.where((mask==2)|(mask==0),0,1).astype('uint8')
# img = img*mask2[:,:,np.newaxis]
# dst = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
# cv2.imshow('dst', dst)
# cv2.waitKey(0)
# cv2.destroyAllWindows()
