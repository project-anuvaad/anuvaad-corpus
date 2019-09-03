/*
 * @Author: ghost 
 * @Date: 2019-08-29 17:32:50 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-08-30 14:22:51
 */
var Corpus = require('../models/corpus');
var Sentence = require('../models/sentence');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var Status = require('../utils/status').Status
var LOG = require('../logger/logger').logger
var UUIDV4 = require('uuid/v4')
var async = require('async');
var fs = require("fs");
var ParallelCorpus = require('../models/parallelCorpus');
var Sentence = require('../models/sentence')
const CJSON = require('circular-json');

var COMPONENT = "corpus";
var PARALLEL_CORPUS_COMPONENT = "parallelCorpus";


exports.fetchCorpus = function (req, res) {
    Corpus.fetchAll((err, corpus) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, corpus).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.uploadCorpus = function (req, res) {
    //Check required params
    if (!req.files || req.files.length == 0 || !req.body || !req.body.name || !req.body.lang) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    let corpusid = UUIDV4()
    //Create corpus obj and save
    let corpus = { status: 'ACTIVE', created_on: new Date(), corpusid: corpusid, name: req.body.name, lang: req.body.lang }
    corpus.tags = ['BASE_CORPUS', req.body.lang]
    Corpus.saveCorpus(corpus, (err, doc) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        fs.readFile(req.files[0].path, 'utf8', function (err, data) {
            if(data.length>0){
                let sentences = data.split('\n')
                let sentencearr = []
                sentences.map((sentence, index)=>{
                    let sentenceobj = {sentence:sentence, index:index}
                    sentenceobj.tags = [corpusid, req.body.lang]
                    sentenceobj.original = true
                    sentenceobj.parallelcorpusid = []
                    sentencearr.push(sentenceobj)
                })
                Sentence.saveSentences(sentencearr, (err, docs)=>{
                    if (err) {
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                    let apistatus = new APIStatus(StatusCode.SUCCESS, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                })
            }
        })
    })
}

exports.fetchParallelCorpus = function (req, res) {
    Corpus.fetchAll((err, corpus) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, corpus).getRsp()
        return res.status(response.http.status).json(response);
    })
}

exports.getParallelCorpusSentence = function(req, res){
    var basename = req.query.basename
    if (basename == null || basename.length == 0){
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_MISSING_PARAMETERS, PARALLEL_CORPUS_COMPONENT).getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
    }
    ParallelCorpus.findById(basename,(err, result)=>{
        if (err){
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }

        sourceId = result.source_id
        targetId = result.target_id
        console.log("sourceId = "+sourceId)
        console.log("targetId = "+targetId)
        Sentence.findWithtagId(basename, sourceId, (err, source_sentences) =>{
            if (err){
                console.log("error while finding source sentence")
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            console.log("source sentences are "+CJSON.stringify( source_sentences))
            Sentence.findWithtagId(basename, targetId, (err, target_sentences) =>{ 
                if (err){
                    console.log("error while finding target sentence")
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                console.log("target sentences are "+target_sentences.sentence)
                let results = {'source':source_sentences.sentence,'target':target_sentences.sentence}
                let response = new Response(StatusCode.SUCCESS, results).getRsp()
                return res.status(response.http.status).json(response);
            })
        })
    })
}



