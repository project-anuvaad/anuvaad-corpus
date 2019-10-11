/*
 * @Author: ghost 
 * @Date: 2019-08-29 17:32:50 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-08-30 14:22:51
 */
var Benchmark = require('../models/benchmark');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var Sentence = require('../models/sentence');
var StatusCode = require('../errors/statuscodes').StatusCode
var LOG = require('../logger/logger').logger
var axios = require('axios')
var async = require('async')
var COMPONENT = "benchmark";


exports.fetchBenchmark = function (req, res) {
    Benchmark.fetchAll((err, benchmarks) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, benchmarks).getRsp()
        return res.status(response.http.status).json(response);
    })
}


exports.fetchBenchmarkSentences = function (req, res) {
    var basename = req.query.basename
    var pagesize = req.query.pagesize
    var pageno = req.query.pageno
    var model_id = req.query.modelid
    var status = req.query.status
    if (basename == null || basename.length == 0 && !model_id) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, PARALLEL_CORPUS_COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    if (pagesize && pagesize > 30) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MAX_LIMIT_EXCEEDED, PARALLEL_CORPUS_COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    if (!pagesize) {
        pagesize = 30
        pageno = 1
    }
    Sentence.countDocuments({ basename: basename }, function (err, totalcount) {
        Sentence.countDocuments({ basename: basename + '_' + model_id }, function (err, count) {
            if (count > 0) {
                Sentence.fetch(basename + '_' + model_id, pagesize, pageno, status, function (err, sentences) {
                    if (err) {
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    return translateByAnuvaad(sentences, model_id, totalcount, res)
                    // let response = new Response(StatusCode.SUCCESS, sentences, count).getRsp()
                    // return res.status(response.http.status).json(response);
                })
            }
            else {
                Sentence.fetch(basename, pagesize, pageno, status, function (err, sentences) {
                    if (err) {
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    let sentences_arr = []
                    sentences.map((s) => {
                        s['_doc']['basename'] = basename + '_' + model_id
                        s['_doc']['_id'] = null
                        sentences_arr.push(s['_doc'])
                    })
                    Sentence.saveSentences(sentences_arr, function (err, sentences) {
                        if (err) {
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        }
                        Sentence.fetch(basename + '_' + model_id, pagesize, pageno, status, function (err, sentences) {
                            if (err) {
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                            return translateByAnuvaad(sentences, model_id, totalcountc, res)
                            // let response = new Response(StatusCode.SUCCESS, sentences, sentences_arr.length).getRsp()
                            // return res.status(response.http.status).json(response);
                        })
                    })
                })
            }
        })
    })
}


var translateByAnuvaad = function (sentences, modelid, count, res) {
    let req_arr = []
    let data_arr = []
    let target_not_available = false
    sentences.map((s) => {
        if (!s['_doc']['target']) {
            target_not_available = true
        }
        let req = { "src": s['_doc']['source'], "id": parseInt(modelid) }
        req_arr.push(req)

    })
    if (!target_not_available) {
        let response = new Response(StatusCode.SUCCESS, sentences, req_arr.length).getRsp()
        return res.status(response.http.status).json(response);
    }
    axios
        .post('http://52.40.71.62:3003/translator/translation_en', req_arr)
        .then(res_anuvaad => {
            LOG.info(res_anuvaad.data)
            let response_body = res_anuvaad.data['response_body']
            sentences.map((s, index) => {
                s['_doc']['target'] = response_body[index]['tgt']
                data_arr.push(s['_doc'])

            })
            async.waterfall([
                function (callback) {
                    async.each(data_arr, function (d, callback) {
                        Sentence.updateSentenceData(d, function (err, doc) {
                            LOG.info(err)
                            callback()
                        })

                    }, function (err) {
                        callback()
                    });
                },
                function () {
                    let response = new Response(StatusCode.SUCCESS, data_arr, count).getRsp()
                    return res.status(response.http.status).json(response);
                }
            ])
        })
        .catch(err => {
            LOG.error(err)
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        });
}