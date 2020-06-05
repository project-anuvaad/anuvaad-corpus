/*
 * @Author: ghost 
 * @Date: 2020-03-04 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2020-03-04 10:18:27
 */
var pdfParserController = require('../../controllers/pdf_parser');


module.exports = function (router) {
    router.route('/start-pdf-parse-process')
        .post(pdfParserController.savePdfParserProcess);

    router.route('/translate-pdf')
        .post(pdfParserController.translatePdf);

    router.route('/fetch-pdf-parse-process')
        .get(pdfParserController.fetchPdfParserProcess);

    router.route('/fetch-pdf-sentences')
        .get(pdfParserController.fetchPdfSentences);

    router.route('/update-pdf-sentences')
        .post(pdfParserController.updatePdfSentences);

    router.route('/extract-paragraphs')
        .post(pdfParserController.extractParagraphs);

    router.route('/extract-paragraphs-pagewise')
        .post(pdfParserController.extractParagraphsPerPages);

    router.route('/make-doc-from-sentences')
        .post(pdfParserController.makeDocFromSentences);

    router.route('/extract-pdf-paragraphs')
        .post(pdfParserController.extractPdfParagraphs);

    router.route('/extract-pdf-to-sentences')
        .post(pdfParserController.extractPdfToSentences);

    router.route('/merge-split-sentence')
        .post(pdfParserController.mergeSplitSentence);

    router.route('/update-pdf-source-sentences')
        .post(pdfParserController.updatePdfSourceSentences);

    router.route('/update-pdf-source-table')
        .post(pdfParserController.updatePdfSourceTable);

    router.route('/delete-sentence')
        .post(pdfParserController.deleteSentence);

}