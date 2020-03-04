var mongoose = require("../db/mongoose");
var LOG = require('../logger/logger').logger
var Schema = mongoose.Schema;

var PdfParserSchema = new Schema({
    _id: {type: String},
}, { strict: false });
var PdfParser = mongoose.model('pdf_parser', PdfParserSchema, 'pdf_parser');

module.exports = PdfParser;