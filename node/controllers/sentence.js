/*
 * @Author: ghost 
 * @Date: 2019-08-29 17:32:50 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-08-30 14:22:51
 */
var Jobs = require('../models/job');
var Corpus = require('../models/corpus');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var Status = require('../utils/status').Status
var LOG = require('../logger/logger').logger
var glob = require("glob")
var UUIDV4 = require('uuid/v4')
var async = require('async');
var fs = require("fs");
const STATUS_PROCESSING = 'PROCESSING'
const UPLOAD_DIR = './corpusfiles/'
const PROCESSING_DIR = 'processing/'
const TARGET_IDENTIFIER = '_target'
const TOKENIZER = '_'
const EXTENSION = '.txt'

var COMPONENT = "sentences";
const TRANSLATORS = ['f517d392-a840-455d-bdde-196def6f2f0a','4d6c1fb9-b90a-421b-b784-fe9510d9640f']


exports.assignBatch = function(){
    
}


exports.saveSentences = function () {
    fs.readdir(UPLOAD_DIR, function (err, files) {
        if (err) {
            LOG.error(err)
        } else {
            if (!files.length) {
                LOG.info('no files exist')
            }
            else {
                files.map((f) => {
                    if (!fs.lstatSync(UPLOAD_DIR + f).isDirectory()) {
                        if (f.indexOf(TARGET_IDENTIFIER) < 0) {
                            glob(UPLOAD_DIR + f.split(TOKENIZER)[0] + TARGET_IDENTIFIER + "*", function (er, targetfiles) {
                                if (!files.length) {
                                    LOG.error('Target file not found for [%s]', f)
                                }
                                else {
                                    let target_file_name = targetfiles[0]
                                    let job = { source_file_name: f, target_file_name: target_file_name, updated_on: new Date() }
                                    async.waterfall([
                                        function (callback) {
                                            fs.rename(UPLOAD_DIR + f, UPLOAD_DIR + PROCESSING_DIR + f, function (err) {
                                                if (err) {
                                                    LOG.error(err)
                                                    callback(err)
                                                }
                                                LOG.info('Successfully moved [%s]', f)
                                                callback(null)
                                            })
                                        },
                                        function (callback) {
                                            fs.rename(target_file_name, UPLOAD_DIR + PROCESSING_DIR + target_file_name.split('/')[target_file_name.split('/').length - 1], function (err) {
                                                if (err) {
                                                    LOG.error(err)
                                                    callback(err)
                                                }
                                                LOG.info('Successfully moved [%s]', target_file_name)
                                            })
                                            callback(null)
                                        }
                                    ], function (error) {
                                        if (error) { LOG.error(error); }
                                        else {
                                            Jobs.saveJob(job, function (err, data) {
                                                if (err) {
                                                    LOG.error(err)
                                                }
                                                else {
                                                    saveMetaDataForSentences(f, target_file_name.split('/')[target_file_name.split('/').length - 1])
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    }
                })
            }
        }
    });
}

var saveMetaDataForSentences = function (source, target) {
    let sourcecorpusid = UUIDV4()
    let targetcorpusid = UUIDV4()
    let source_lang = source.split(TOKENIZER)[source.split(TOKENIZER).length - 1].split(EXTENSION)[0]
    let target_lang = target.split(TOKENIZER)[target.split(TOKENIZER).length - 1].split(EXTENSION)[0]
    //Create corpus obj and save
    let corpus = { status: STATUS_PROCESSING, created_on: new Date(), corpusid: sourcecorpusid, name: source.split(TOKENIZER)[0], lang: source_lang }
    corpus.tags = ['BASE_CORPUS', source_lang]

    let targetcorpus = { status: STATUS_PROCESSING, created_on: new Date(), corpusid: targetcorpusid, name: target.split(TOKENIZER)[0], lang: target_lang }
    targetcorpus.tags = ['BASE_CORPUS', target_lang]

    Corpus.saveCorpus([corpus, targetcorpus], (err, doc) => {
        if (err) {
            LOG.error(err)
        }
        else {
            LOG.info(doc)
        }
    })

}
