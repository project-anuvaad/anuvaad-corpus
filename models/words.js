/**
 * @author [aroop]
 * @email [aroop.ghosh@tarento.com]
 * @create date 2019-05-24 16:43:41
 * @modify date 2019-05-24 16:43:41
 * @desc [description]
 */
var mongoose = require("../db/mongoose");
var Schema = mongoose.Schema;

var WordsSchema = new Schema({
    text: {type: String},
}, { strict: false });
var Words = mongoose.model('words', WordsSchema);

module.exports = Words;