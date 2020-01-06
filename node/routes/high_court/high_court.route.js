/*
 * @Author: ghost 
 * @Date: 2020-01-06 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2020-01-06 10:18:27
 */
var highCourtController = require('../../controllers/high_court');


module.exports = function (router) {
    router.route('/fetch-high-courts')
        .get(highCourtController.fetchHighCourts);

    router.route('/update-high-court')
        .post(highCourtController.updateHighCourts);

    router.route('/save-high-court')
        .post(highCourtController.saveHighCourt);

}