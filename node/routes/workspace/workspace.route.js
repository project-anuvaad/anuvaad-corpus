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

    router.route('/save-paragraph-workspace-data')
        .post(workspaceController.saveParagraphWorkspaceData);

    router.route('/save-mt-workspace')
        .post(workspaceController.saveMTWorkspace);

    router.route('/save-mt-workspace-data')
        .post(workspaceController.saveMTWorkspaceData);

    router.route('/save-search-replace-workspace')
        .post(workspaceController.saveSearchReplaceWorkspace);

    router.route('/save-composition-workspace')
        .post(workspaceController.saveCompositionWorkspace);

    router.route('/start-tokenization')
        .post(workspaceController.startTokenization);

    router.route('/fetch-paragraph-workspace')
        .get(workspaceController.fetchParagraphWorkspace);

    router.route('/fetch-search-replace-sentence')
        .get(workspaceController.fetchSearchReplaceSentence);

    router.route('/fetch-composition-workspace')
        .get(workspaceController.fetchCompositionWorkspace);

    router.route('/update-search-replace-sentence')
        .post(workspaceController.updateSearchReplaceSentence);

    router.route('/accept-all-search-replace-sentence')
        .post(workspaceController.acceptAllSearchReplaceSentence);

    router.route('/fetch-mt-workspace')
        .get(workspaceController.fetchMTWorkspace);

    router.route('/fetch-search-replace-workspace')
        .get(workspaceController.fetchSearchReplaceWorkspace);

    router.route('/fetch-search-replace-workspace-detail')
        .get(workspaceController.fetchSearchReplaceWorkspaceDetail);

    router.route('/fetch-composition-workspace-detail')
        .get(workspaceController.fetchCompositionWorkspaceDetail);

    router.route('/fetch-mt-workspace-detail')
        .get(workspaceController.fetchMTWorkspaceDetail);

    router.route('/fetch-paragraph-workspace-detail')
        .get(workspaceController.fetchParagraphWorkspaceDetail);

    router.route('/migrate-old-data')
        .get(workspaceController.migrateOldData);

}