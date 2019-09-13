/*
 * @Author: ghost 
 * @Date: 2019-08-29 17:32:50 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-08-30 14:22:51
 */
var Jobs = require('../models/job');
var Corpus = require('../models/corpus');
var Sentence = require('../models/sentence');
var LOG = require('../logger/logger').logger
var glob = require("glob")
var UUIDV4 = require('uuid/v4')
var async = require('async');
var axios = require('axios');
var fs = require("fs");
const STATUS_PROCESSING = 'PROCESSING'
const STATUS_ACCEPTED = 'ACCEPTED'
const UPLOAD_DIR = './corpusfiles/'
const PROCESSING_DIR = 'processing/'
const TARGET_IDENTIFIER = '_target'
const TOKENIZER = '_'
const EXTENSION = '.txt'
const MIN_LIMIT = 200

var COMPONENT = "sentences";
const ES_SERVER_URL = 'http://nlp-nmt-160078446.us-west-2.elb.amazonaws.com/'
const USERS_REQ_URL = ES_SERVER_URL + 'admin/users?count=1000'
const PROFILE_REQ_URL = ES_SERVER_URL + 'corpus/get-profiles'
const EDITOR_ROLE = 'editor'

exports.assignBatch = function () {
    axios.get(USERS_REQ_URL).then((res) => {
        if (res.data && res.data.users && Array.isArray(res.data.users)) {
            let userIds = []
            res.data.users.map((u) => {
                if (u.isActive) {
                    userIds.push(u.id)
                }
            })
            axios.post(PROFILE_REQ_URL, { userids: userIds }).then((res) => {
                if (res.data) {
                    if (res.data.data && Array.isArray(res.data.data)) {
                        res.data.data.map((p) => {
                            if (p.roles && p.roles.includes(EDITOR_ROLE)) {
                                checkForEditor(p.id, p.username)
                            }
                        })
                    }
                }
            }).catch((e) => {
                LOG.error(e)
            })
        }
    }).catch((e) => {
        LOG.error(e)
    })
}

var checkForEditor = function (id, username) {
    LOG.info('Checking for [%s]', username)
    Sentence.fetchByAssignedTo({ $ne: STATUS_ACCEPTED }, id, (err, sentences) => {
        if (err) {
            LOG.error(err)
        } else {
            LOG.info('Sentences found [%d]', sentences.length)
            if (sentences.length < MIN_LIMIT) {
                LOG.info('Syncing with data lake for %s', username)
                Sentence.fetchByAssignedTo(STATUS_ACCEPTED, id, (err, sentences) => {
                    //Todo: send sentences to data lake before deleting
                    if (sentences && Array.isArray(sentences) && sentences.length > 0) {
                        Sentence.deleteMany({ status: STATUS_ACCEPTED, assigned_to: id }, (err, docs) => {
                            if (err) {
                                LOG.error(err)
                            } else {
                                LOG.info('Sentences deleted for %s', username)
                            }
                        })
                    }
                })
            }
        }
    })
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
