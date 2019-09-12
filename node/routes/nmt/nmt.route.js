/*
 * @Author: ghost 
 * @Date: 2019-09-12 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-09-12 10:18:27
 */
var nmtController = require('../../controllers/nmt');


module.exports = function (router) {
    router.route('/fetch-models')
        .get(nmtController.fetchModels);

    router.route('/save-model')
        .post(nmtController.saveModels);

    router.route('/update-model')
        .post(nmtController.updateModels);

    

}