/*
 * @Author: ghost 
 * @Date: 2019-12-12 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-12-12 10:18:27
 */
var workspaceController = require('../../controllers/workspace');


module.exports = function (router) {

    router.route('/save-paragraph-workspace')
        .post(workspaceController.saveParagraphWorkspace);


    router.route('/fetch-paragraph-workspace')
        .get(workspaceController.fetchParagraphWorkspace);

    router.route('/fetch-paragraph-workspace-detail')
        .get(workspaceController.fetchParagraphWorkspaceDetail);

}