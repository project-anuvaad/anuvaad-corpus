var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var PdfSentenceSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var PdfSentence = mongoose.model('pdf_sentence', PdfSentenceSchema, 'pdf_sentence');

module.exports = PdfSentence;