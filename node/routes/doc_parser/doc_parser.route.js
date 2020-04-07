/*
 * @Author: ghost 
 * @Date: 2020-03-20 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2020-03-20 10:18:27
 */
var docParserController = require('../../controllers/docx_parser');


module.exports = function (router) {
    router.route('/parse-doc')
        .post(docParserController.extractDocx);

    router.route('/make-doc')
        .post(docParserController.makeDoc);

}