/**
 * @author [aroop]
 * @email [aroop.ghosh@tarento.com]
 * @create date 2019-12-10 16:43:41
 * @modify date 2019-12-10 16:43:41
 * @desc [description]
 */
var mongoose = require("../db/mongoose");
var Schema = mongoose.Schema;

var ParagraphWorkspaceSchema = new Schema({
    title: {type: String},
    config_file_location: {type: String},
    csv_file_location: {type: String},

}, { strict: false });
var ParagraphWorkspace = mongoose.model('paragraph_workspace', ParagraphWorkspaceSchema);

module.exports = ParagraphWorkspace;