from fpdf import FPDF

def converttopdf(imagepaths):
    pdf = FPDF()
    # imagelist is the list with all image filenames

    for image in imagepaths:
        pdf.add_page()
        pdf.image(image, 0, 0, 220, 300)
    pdf.output("yourfile.pdf", "F")

