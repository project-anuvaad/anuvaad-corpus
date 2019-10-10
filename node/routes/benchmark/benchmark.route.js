/*
 * @Author: ghost 
 * @Date: 2019-09-01 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-09-01 10:18:27
 */
var benchmarkController = require('../../controllers/benchmark');


module.exports = function (router) {
    router.route('/fetch-benchmarks')
        .get(benchmarkController.fetchBenchmark);

    router.route('/fetch-benchmark-sentences')
        .get(benchmarkController.fetchBenchmarkSentences);

    // router.route('/update-sentences')
    //     .post(corpusController.updateSentences);

    // router.route('/update-sentences-status')
    //     .post(corpusController.updateSentencesStatus);

    // router.route('/update-sentences-grade')
    //     .post(corpusController.updateSentencesGrade);

}