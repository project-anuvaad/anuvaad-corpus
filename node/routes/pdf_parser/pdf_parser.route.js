/*
 * @Author: ghost 
 * @Date: 2020-03-04 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2020-03-04 10:18:27
 */
var pdfParserController = require('../../controllers/pdf_parser');
const BASE_PATH = '/v1/interactive-editor'
const BASE_PATH_V2 = '/v2/interactive-editor'

module.exports = function (router) {
    router.route(BASE_PATH + '/start-pdf-parse-process')
        .post(pdfParserController.savePdfParserProcess);

    router.route(BASE_PATH + '/translate-pdf')
        .post(pdfParserController.translatePdf);

    router.route(BASE_PATH + '/fetch-pdf-parse-process')
        .get(pdfParserController.fetchPdfParserProcess);

    router.route(BASE_PATH + '/fetch-pdf-sentences')
        .get(pdfParserController.fetchPdfSentences);

    router.route(BASE_PATH + '/update-pdf-sentences')
        .post(pdfParserController.updatePdfSentences);

    router.route(BASE_PATH + '/extract-paragraphs')
        .post(pdfParserController.extractParagraphs);

    router.route(BASE_PATH + '/extract-paragraphs-pagewise')
        .post(pdfParserController.extractParagraphsPerPages);

    router.route(BASE_PATH + '/make-doc-from-sentences')
        .post(pdfParserController.makeDocFromSentences);

    router.route(BASE_PATH + '/extract-pdf-paragraphs')
        .post(pdfParserController.extractPdfParagraphs);

    router.route(BASE_PATH + '/extract-pdf-to-sentences')
        .post(pdfParserController.extractPdfToSentences);

    router.route(BASE_PATH_V2 + '/extract-pdf-to-sentences')
        .post(pdfParserController.extractPdfToSentencesV2);

    router.route(BASE_PATH + '/merge-split-sentence')
        .post(pdfParserController.mergeSplitSentence);

    router.route(BASE_PATH + '/update-pdf-source-sentences')
        .post(pdfParserController.updatePdfSourceSentences);

    router.route(BASE_PATH + '/update-pdf-source-table')
        .post(pdfParserController.updatePdfSourceTable);

    router.route(BASE_PATH + '/delete-sentence')
        .post(pdfParserController.deleteSentence);

    router.route(BASE_PATH + '/delete-table-sentence')
        .post(pdfParserController.deleteTableSentence);

    router.route(BASE_PATH + '/add-sentence-node')
        .post(pdfParserController.addSentenceNode);

}