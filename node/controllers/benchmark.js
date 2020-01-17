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
const { Translate } = require('@google-cloud/translate');
const projectId = "anuvaad";

const NAMES_BENCHMARK = "1570785751"
const ANUVAAD_URL = process.env.ANUVAAD_URL ? process.env.ANUVAAD_URL : 'http://52.40.71.62:3003'
const HEMAT_URL = process.env.HEMAT_URL ? process.env.HEMAT_URL : 'http://100.22.17.144:5000'


const translate = new Translate({
    projectId: projectId,
});


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

exports.translateWithHemat = function (req, res) {
    let userId = req.headers['ad-userid']
    if (!req || !req.body || !req.body.sentence || !req.body.target) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let reverse = false
    let source_code = 'en'
    let target_code = 'hi'
    let basename = 'INDEPENDENT_' + userId
    if (req.body.target == 'English') {
        reverse = true
        source_code = 'hi'
        target_code = 'en'
    }
    Benchmark.fetchByCondition({ basename: basename }, (err, benchmark) => {
        async.waterfall([
            function (callback) {
                if (!benchmark || benchmark.length == 0) {
                    let benchmark_to_be_saved = { name: 'Miscellaneous Benchmark', basename: basename, assigned_to: userId, status: 'COMPLETED' }
                    Benchmark.insertMany([benchmark_to_be_saved], function (err, doc) {
                        callback()
                    })
                }
                else {
                    callback()
                }
            }
        ], function () {
            let benchmark_sent = { source: req.body.sentence, basename: basename, status: 'PENDING' }
            Sentence.saveSentences([benchmark_sent], function (err, sen_doc) {
                NMT.findByCondition({ is_primary: true, source_language_code: source_code, target_language_code: target_code }, function (err, modeldblist) {
                    if (modeldblist && modeldblist.length > 0) {
                        let model_id = modeldblist[0]['_doc']['model_id']
                        var doc_nmt = Object.create(sen_doc['ops'][0])
                        doc_nmt['_id'] = null
                        doc_nmt['source'] = req.body.sentence
                        doc_nmt['status'] = 'PENDING'
                        doc_nmt['basename'] = basename + '_' + model_id
                        doc_nmt['parent_id'] = sen_doc['ops'][0]['_id']
                        var doc = Object.create(sen_doc['ops'][0])
                        doc['_id'] = null
                        doc['source'] = req.body.sentence
                        doc['status'] = 'PENDING'
                        doc['basename'] = basename + '_hemat'
                        doc['parent_id'] = sen_doc['ops'][0]['_id']
                        Sentence.saveSentences([doc_nmt], function (err, sentences_nmt) {
                            Sentence.saveSentences([doc], function (err, sentences_hemat) {
                                if (err) {
                                    LOG.debug(err)
                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                    return res.status(apistatus.http.status).json(apistatus);
                                }
                                return translateByAnuvaadHemat(basename, [{ '_doc': sentences_nmt['ops'][0] }], [{ '_doc': sentences_hemat['ops'][0] }], model_id, 0, reverse, res)
                            })
                        })
                    }
                })
            })
        })
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
            async.waterfall([
                function (callback) {
                    if (!benchmark[0]._doc.assigned_to) {
                        Benchmark.updateBenchmarkData(benchmark[0], userId, function (err, doc) {
                            if (err) {
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                            callback()
                        })
                    } else {
                        callback()
                    }
                },
                function () {
                    let reverse = false
                    let source_code = 'en'
                    let target_code = 'hi'
                    if (benchmark[0]._doc.source_lang === 'Hindi') {
                        source_code = 'hi'
                        target_code = 'en'
                        reverse = true
                    }
                    NMT.findByCondition({ is_primary: true, source_language_code: source_code, target_language_code: target_code }, function (err, modeldblist) {
                        if (modeldblist && modeldblist.length > 0) {
                            let model_id = modeldblist[0]['_doc']['model_id']
                            Sentence.countDocuments({ basename: basename }, function (err, totalcount) {
                                Sentence.countDocuments({ basename: basename + '_' + model_id }, function (err, count) {
                                    if (count > 0) {
                                        Sentence.fetch(basename + '_' + model_id, pagesize, pageno, null, pending, function (err, sentences) {
                                            Sentence.fetch(basename + '_hemat', pagesize, pageno, null, pending, function (err, sentences_hemat) {
                                                if (err) {
                                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                                    return res.status(apistatus.http.status).json(apistatus);
                                                }
                                                return translateByAnuvaadHemat(basename, sentences, sentences_hemat, model_id, totalcount, reverse, res)
                                                // let response = new Response(StatusCode.SUCCESS, sentences, count).getRsp()
                                                // return res.status(response.http.status).json(response);
                                            })
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
                                                var doc_nmt = Object.create(s['_doc'])
                                                doc_nmt['basename'] = basename + '_' + model_id
                                                doc_nmt['_id'] = null
                                                doc_nmt['parent_id'] = s['_doc']['_id']
                                                sentences_arr.push(doc_nmt)
                                                var doc = Object.create(s['_doc'])
                                                doc['_id'] = null
                                                doc['basename'] = basename + '_hemat'
                                                doc['parent_id'] = s['_doc']['_id']
                                                sentences_arr.push(doc)
                                            })
                                            Sentence.saveSentences(sentences_arr, function (err, sentences) {
                                                if (err) {
                                                    LOG.debug(err)
                                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                                    return res.status(apistatus.http.status).json(apistatus);
                                                }
                                                Sentence.fetch(basename + '_' + model_id, pagesize, pageno, null, pending, function (err, sentences) {
                                                    Sentence.fetch(basename + '_hemat', pagesize, pageno, null, pending, function (err, sentences_hemat) {
                                                        if (err) {
                                                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                                            return res.status(apistatus.http.status).json(apistatus);
                                                        }
                                                        return translateByAnuvaadHemat(basename, sentences, sentences_hemat, model_id, totalcount, reverse, res)
                                                        // let response = new Response(StatusCode.SUCCESS, sentences, sentences_arr.length).getRsp()
                                                        // return res.status(response.http.status).json(response);
                                                    })
                                                })
                                            })
                                        })
                                    }
                                })
                            })
                        }
                        else {
                            LOG.debug('Model not found for benchmark ', benchmark.name)
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_NOTFOUND, COMPONENT).getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        }
                    })
                }])
        }
        else {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_NOTFOUND, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
    })
}

var translateByAnuvaadHemat = function (basename, sentences, sentences_hemat, modelid, totalcount, reverse, res) {
    let req_arr = []
    let req_arr_hemat = []
    let target_not_available = false
    sentences.map((s) => {
        if (!s['_doc']['target']) {
            target_not_available = true
        }
        let req = { "src": s['_doc']['source'], "id": parseInt(modelid) }
        req_arr.push(req)
        req_arr_hemat.push(s['_doc']['source'])

    })
    let req_hemat = { "source": req_arr_hemat, "direction": reverse ? "hien" : "enhi" }
    if (!target_not_available) {
        let query_condition = { basename: basename + '_' + modelid, rating: { $gt: 0 }, spelling_rating: { $gt: 0 }, context_rating: { $gt: 0 } }
        Sentence.countDocuments(query_condition, function (err, countNonPending) {
            if (err) {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            // Sentence.sumRatings(basename + '_' + modelid, function (err, ratings) {
            //     if (err) {
            //         let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            //         return res.status(apistatus.http.status).json(apistatus);
            //     }
            let sentence_res = sentences.concat(sentences_hemat)
            sentence_res = shuffle(sentence_res)
            let response = new Response(StatusCode.SUCCESS, sentence_res, totalcount, null, totalcount - countNonPending).getRsp()
            return res.status(response.http.status).json(response);
            // })
        })
    } else {
        let data_arr = []
        async.waterfall([
            function (callback) {
                callTranslationApi(sentences, `${ANUVAAD_URL}/translator/` + (reverse ? 'translation_hi' : 'translation_en'), false, req_arr, res, callback)
            },
            function (data, callback) {
                data_arr = data_arr.concat(data)
                callTranslationApi(sentences_hemat, `${HEMAT_URL}/translate`, true, req_hemat, res, callback)
            }
        ], function (err, data) {
            data_arr = data_arr.concat(data)
            data_arr = shuffle(data_arr)
            let query_condition = { basename: basename + '_' + modelid, rating: { $gt: 0 }, spelling_rating: { $gt: 0 }, context_rating: { $gt: 0 } }
            Sentence.countDocuments(query_condition, function (err, countNonPending) {
                if (err) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                // Sentence.sumRatings(basename + '_' + modelid, function (err, ratings) {
                //     if (err) {
                //         let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                //         return res.status(apistatus.http.status).json(apistatus);
                //     }
                let response = new Response(StatusCode.SUCCESS, data_arr, totalcount, null, totalcount - countNonPending).getRsp()
                return res.status(response.http.status).json(response);
                // })
            })

        })
    }
}

var callTranslationApi = function (sentences, endpoint, is_hemat, req_arr, res, cb) {
    let data_arr = []
    let req_start_time = new Date().getTime()
    LOG.debug('Calling api', endpoint)
    axios
        .post(endpoint, req_arr)
        .then(res_anuvaad => {
            let res_end_time = new Date().getTime()
            if (is_hemat) {
                let response_body = res_anuvaad.data.data
                sentences.map((s, index) => {
                    s['_doc']['target'] = response_body[index]['target']
                    s['_doc']['time_taken'] = res_end_time - req_start_time
                    data_arr.push(s['_doc'])
                })
            }
            else {
                let response_body = res_anuvaad.data['response_body']
                sentences.map((s, index) => {
                    s['_doc']['target'] = response_body && response_body.length > 0 ? response_body[index]['tgt'] : ''
                    s['_doc']['time_taken'] = res_end_time - req_start_time
                    data_arr.push(s['_doc'])

                })
            }
            async.each(data_arr, function (d, callback) {
                Sentence.updateSentenceData(d, function (err, doc) {
                    callback()
                })

            }, function (err) {
                cb(err, data_arr)
            });

        })
        .catch(err => {
            LOG.error('Error received', err)
            cb(null, data_arr)
        });
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
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    if (pagesize && pagesize > 30) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MAX_LIMIT_EXCEEDED, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    if (status && status == 'PENDING') {
        pending = true
    }
    if (!pagesize) {
        pagesize = 1
        pageno = 1
    }
    Benchmark.fetchByCondition({ basename: basename }, (err, benchmark) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        if (benchmark) {
            async.waterfall([
                function (callback) {
                    if (!benchmark[0]._doc.assigned_to) {
                        Benchmark.updateBenchmarkData(benchmark[0], userId, function (err, doc) {
                            if (err) {
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                            callback()
                        })
                    }
                    else {
                        callback()
                    }
                }, function () {
                    Sentence.countDocuments({ basename: basename }, function (err, totalcount) {
                        Sentence.countDocuments({ basename: basename + '_' + model_id }, function (err, count) {
                            if (count > 0) {
                                Sentence.fetch(basename + '_' + model_id, pagesize, pageno, null, pending, function (err, sentences) {
                                    if (err) {
                                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                                        return res.status(apistatus.http.status).json(apistatus);
                                    }
                                    if (model_id.indexOf('google') > -1) {
                                        return translateByGoogle(basename, sentences, model_id, totalcount, res)
                                    } else {
                                        return translateByAnuvaad(basename, sentences, model_id, totalcount, res)
                                    }
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
                                            if (model_id.indexOf('google') > -1) {
                                                return translateByGoogle(basename, sentences, model_id, totalcount, res)
                                            }
                                            else {
                                                return translateByAnuvaad(basename, sentences, model_id, totalcount, res)
                                            }

                                            // let response = new Response(StatusCode.SUCCESS, sentences, sentences_arr.length).getRsp()
                                            // return res.status(response.http.status).json(response);
                                        })
                                    })
                                })
                            }
                        })
                    })
                }])
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
            .post(`${ANUVAAD_URL}/translator/translation_en`, req_arr)
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
                                LOG.debug(err)
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



var translateByGoogle = function (basename, sentences, modelid, totalcount, res) {
    let req_arr = []
    let data_arr = []
    let target_not_available = false
    sentences.map((s) => {
        if (!s['_doc']['target']) {
            target_not_available = true
        }
        req_arr.push(s['_doc']['source'])

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
        translate
            .translate(req_arr, modelid.indexOf('-') > -1 ? modelid.split('-')[1] : 'hi')
            .then(res_google => {
                let response_body = res_google[0]
                sentences.map((s, index) => {
                    s['_doc']['target'] = response_body[index]
                    data_arr.push(s['_doc'])

                })
                async.waterfall([
                    function (callback) {
                        async.each(data_arr, function (d, callback) {
                            Sentence.updateSentenceData(d, function (err, doc) {
                                LOG.debug(err)
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

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}