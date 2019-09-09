/*
 * @Author: ghost 
 * @Date: 2019-09-01 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-09-01 10:18:27
 */
var corpusController = require('../../controllers/corpus');


module.exports = function (router) {
    router.route('/fetch-corpus')
        .get(corpusController.fetchCorpus);

    router.route('/fetch-corpus-sentences')
        .get(corpusController.fetchCorpusSentences);

    router.route('/update-sentences')
        .post(corpusController.updateSentences);

    router.route('/update-sentences-status')
        .post(corpusController.updateSentencesStatus);

    router.route('/update-sentences-grade')
        .post(corpusController.updateSentencesGrade);

    router.route('/upload-corpus')
        .post(corpusController.uploadCorpus);
    
    router.route('/get-parallel-corpus-sentences')
        .get(corpusController.getParallelCorpusSentence);

    router.route('/fetch-parallel-corpus')
        .get(corpusController.fetchParallelCorpus);

}