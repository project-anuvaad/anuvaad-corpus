/*
 * @Author: ghost 
 * @Date: 2019-12-19 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-12-19 10:18:27
 */
var configsController = require('../../controllers/config');


module.exports = function (router) {

    router.route('/fetch-default-config')
        .get(configsController.fetchDefaultConfigs);

}