var PdfToImage = require('./utils/pdf_to_image')
var Corpus = require('./controllers/corpus')
var fs = require("fs");



var req = {}
var res = {}
var dirname = 'egag';
fs.readdir(dirname, function (err, filenames) {
    if (err) {
        console.log(err);
    }
    console.log(filenames.length)
    processFiles(dirname, filenames, 0)
})


function processFiles(dirname, filenames, index) {
    console.log(dirname + '/' + filenames[index])
    PdfToImage.convertToImage(dirname + '/' + filenames[index], function (image_paths) {
        req.image_paths = image_paths
        Corpus.processImage(req, res, true)
        index++;
        if (index !== filenames.length) {
            processFiles(dirname, filenames, index)
        }
    });
}