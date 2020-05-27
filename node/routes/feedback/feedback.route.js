/*
 * @Author: ghost 
 * @Date: 2020-01-29 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2020-01-29 10:18:27
 */
var feedbackController = require('../../controllers/feedback');


module.exports = function (router) {
    router.route('/fetch-feedback-questions')
        .get(feedbackController.fetchFeedbackQuestions);

    router.route('/save-feedback-questions')
        .post(feedbackController.saveFeedbackQuestions);

    router.route('/check-feedback-pending')
        .get(feedbackController.checkFeedbackPending);

    router.route('/save-captured-feedback')
        .post(feedbackController.saveCapturedFeedback);

}