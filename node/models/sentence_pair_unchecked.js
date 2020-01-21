/**
 * @author [aroop]
 * @email [aroop.ghosh@tarento.com]
 * @create date 2019-01-21 16:43:41
 * @modify date 2019-01-21 16:43:41
 * @desc [description]
 */
var mongoose = require("../db/mongoose");
var Schema = mongoose.Schema;
var LOG = require('../logger/logger').logger

var SentencePairUncheckedSchema = new Schema({
    processId: { type: String },

}, { strict: false });
var SentencePairUnchecked = mongoose.model('sentence_pair_unchecked', SentencePairUncheckedSchema, 'sentence_pair_unchecked');


module.exports = SentencePairUnchecked;