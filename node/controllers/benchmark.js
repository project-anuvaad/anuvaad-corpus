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
var NMT = require('../models/nmt');

const NAMES_BENCHMARK = "1570785751"


exports.fetchBenchmark = function (req, res) {
    let userId = req.headers['ad-userid']
    Benchmark.fetchAll({ $or: [{ assigned_to: { $exists: false } }, { 'assigned_to': userId }] }, (err, benchmarks) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, benchmarks).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.fetchBenchmarkCompareSentences = function (req, res) {
    var basename = req.query.basename
    let userId = req.headers['ad-userid']
    var pagesize = req.query.pagesize
    var pageno = req.query.pageno
    // var model_id = req.query.modelid
    var status = req.query.status
    var pending = false
    if (basename == null || basename.length == 0) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, PARALLEL_CORPUS_COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    if (pagesize && pagesize > 30) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MAX_LIMIT_EXCEEDED, PARALLEL_CORPUS_COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    if (status && status == 'PENDING') {
        pending = true
    }
    if (!pagesize) {
        pagesize = 5
        pageno = 1
    }
    Benchmark.fetchByCondition({ basename: basename }, (err, benchmark) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        if (benchmark) {
            Benchmark.updateBenchmarkData(benchmark[0], userId, function (err, doc) {
                if (err) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let source_code = 'en'
                let target_code = 'hi'
                if (benchmark.source_lang === 'Hindi') {
                    source_code = 'hi'
                    target_code = 'en'
                }
                NMT.findByCondition({ is_primary: true, source_language_code: source_code, target_language_code: target_code }, function (err, modeldblist) {
                    if (modeldblist && modeldblist.length > 0) {
                        let model_id = modeldblist[0].model_id
                        Sentence.countDocuments({ basename: basename }, function (err, totalcount) {
                            Sentence.countDocuments({ basename: basename + '_' + model_id }, function (err, count) {
                                if (count > 0) {
                                    Sentence.fetch(basename + '_' + model_id, pagesize, pageno, null, pending, function (err, sentences) {
                                        if (err) {
                                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                            return res.status(apistatus.http.status).json(apistatus);
                                        }
                                        return translateByAnuvaad(basename, sentences, model_id, totalcount, res)
                                        // let response = new Response(StatusCode.SUCCESS, sentences, count).getRsp()
                                        // return res.status(response.http.status).json(response);
                                    })
                                }
                                else {
                                    Sentence.fetch(basename, null, null, null, null, function (err, sentences) {
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
                                            Sentence.fetch(basename + '_' + model_id, pagesize, pageno, null, pending, function (err, sentences) {
                                                if (err) {
                                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                                    return res.status(apistatus.http.status).json(apistatus);
                                                }
                                                return translateByAnuvaad(basename, sentences, model_id, totalcount, res)
                                                // let response = new Response(StatusCode.SUCCESS, sentences, sentences_arr.length).getRsp()
                                                // return res.status(response.http.status).json(response);
                                            })
                                        })
                                    })
                                }
                            })
                        })
                    }
                    else {
                        LOG.info('Model not found for benchmark ',benchmark.name)
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_NOTFOUND, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                })
            })

        }
        else {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
    })
}

exports.fetchBenchmarkSentences = function (req, res) {
    var basename = req.query.basename
    let userId = req.headers['ad-userid']
    var pagesize = req.query.pagesize
    var pageno = req.query.pageno
    var model_id = req.query.modelid
    var status = req.query.status
    var pending = false
    if (basename == null || basename.length == 0 && !model_id) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, PARALLEL_CORPUS_COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    if (pagesize && pagesize > 30) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MAX_LIMIT_EXCEEDED, PARALLEL_CORPUS_COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    if (status && status == 'PENDING') {
        pending = true
    }
    if (!pagesize) {
        pagesize = 5
        pageno = 1
    }
    Benchmark.fetchByCondition({ basename: basename }, (err, benchmark) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        if (benchmark) {
            Benchmark.updateBenchmarkData(benchmark[0], userId, function (err, doc) {
                if (err) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                Sentence.countDocuments({ basename: basename }, function (err, totalcount) {
                    Sentence.countDocuments({ basename: basename + '_' + model_id }, function (err, count) {
                        if (count > 0) {
                            Sentence.fetch(basename + '_' + model_id, pagesize, pageno, null, pending, function (err, sentences) {
                                if (err) {
                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                    return res.status(apistatus.http.status).json(apistatus);
                                }
                                return translateByAnuvaad(basename, sentences, model_id, totalcount, res)
                                // let response = new Response(StatusCode.SUCCESS, sentences, count).getRsp()
                                // return res.status(response.http.status).json(response);
                            })
                        }
                        else {
                            Sentence.fetch(basename, null, null, null, null, function (err, sentences) {
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
                                    Sentence.fetch(basename + '_' + model_id, pagesize, pageno, null, pending, function (err, sentences) {
                                        if (err) {
                                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                            return res.status(apistatus.http.status).json(apistatus);
                                        }
                                        return translateByAnuvaad(basename, sentences, model_id, totalcount, res)
                                        // let response = new Response(StatusCode.SUCCESS, sentences, sentences_arr.length).getRsp()
                                        // return res.status(response.http.status).json(response);
                                    })
                                })
                            })
                        }
                    })
                })
            })
        }
        else {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
    })
}


var translateByAnuvaad = function (basename, sentences, modelid, totalcount, res) {
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
        let query_condition = { basename: basename + '_' + modelid, rating: { $gt: 0 }, spelling_rating: { $gt: 0 }, context_rating: { $gt: 0 } }
        if (basename === NAMES_BENCHMARK) {
            query_condition = { basename: basename + '_' + modelid, rating: { $gt: 0 }, spelling_rating: { $gt: 0 }, context_rating: { $gt: 0 }, name_accuracy_rating: { $gt: 0 } }
        }
        Sentence.countDocuments(query_condition, function (err, countNonPending) {
            if (err) {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            Sentence.sumRatings(basename + '_' + modelid, function (err, ratings) {
                if (err) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                let response = new Response(StatusCode.SUCCESS, sentences, totalcount, ratings[0], totalcount - countNonPending).getRsp()
                return res.status(response.http.status).json(response);
            })
        })
    } else {
        axios
            .post('http://52.40.71.62:3003/translator/translation_en', req_arr)
            .then(res_anuvaad => {
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
                        let query_condition = { basename: basename + '_' + modelid, rating: { $gt: 0 }, spelling_rating: { $gt: 0 }, context_rating: { $gt: 0 } }
                        if (basename === NAMES_BENCHMARK) {
                            query_condition = { basename: basename + '_' + modelid, rating: { $gt: 0 }, spelling_rating: { $gt: 0 }, context_rating: { $gt: 0 }, name_accuracy_rating: { $gt: 0 } }
                        }
                        Sentence.countDocuments(query_condition, function (err, countNonPending) {
                            if (err) {
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                            Sentence.sumRatings(basename + '_' + modelid, function (err, ratings) {
                                if (err) {
                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                    return res.status(apistatus.http.status).json(apistatus);
                                }
                                let response = new Response(StatusCode.SUCCESS, data_arr, totalcount, ratings[0], totalcount - countNonPending).getRsp()
                                return res.status(response.http.status).json(response);
                            })
                        })

                    }
                ])
            })
            .catch(err => {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            });
    }
}