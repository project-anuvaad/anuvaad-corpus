/*
 * @Author: ghost 
 * @Date: 2019-09-12 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-09-12 10:18:27
 */
var reportsController = require('../../controllers/reports');


module.exports = function (router) {
    router.route('/fetch-reports')
        .get(reportsController.fetchReports);

}