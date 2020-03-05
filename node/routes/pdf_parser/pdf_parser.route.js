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

    router.route('/fetch-pdf-parse-process')
        .get(pdfParserController.fetchPdfParserProcess);

    router.route('/fetch-pdf-sentences')
        .get(pdfParserController.fetchPdfSentences);

}