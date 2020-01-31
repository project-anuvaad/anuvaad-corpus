var fs = require('fs');
var CsvReadableStream = require('csv-reader');

exports.countSentence = function (path, cb) {
    var inputStream = fs.createReadStream(path, 'utf8');
    var sentenceCount = 0
    inputStream
        .pipe(CsvReadableStream({ parseNumbers: true, parseBooleans: true, trim: true }))
        .on('data', function (row) {
            sentenceCount++
        })
        .on('end', function (data) {
            cb(sentenceCount);
        });
}