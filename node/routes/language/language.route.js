/*
 * @Author: ghost 
 * @Date: 2019-09-12 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-09-12 10:18:27
 */
var languageController = require('../../controllers/language');


module.exports = function (router) {
    router.route('/fetch-languages')
        .get(languageController.fetchLanguages);

    router.route('/save-language')
        .post(languageController.saveLanguages);

}