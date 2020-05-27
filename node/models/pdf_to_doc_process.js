var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var PdfDocProcessSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var PdfDocProcess = mongoose.model('pdf_doc_process', PdfDocProcessSchema, 'pdf_doc_process');

module.exports = PdfDocProcess;