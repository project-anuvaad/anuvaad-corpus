
var Words = require('../../models/words');
var LOG = require('../../logger/logger').logger

module.exports.saveWords = function (words) {
    LOG.info('saving')
    Words.insertMany(words, {
        upsert: true
    })
        .then(function (docs) {
            LOG.info(docs)
            /* ... */
        })
        .catch(function (err) {
            /* Error handling */
        });

}


module.exports.fetchWords = function (sentence, timestamp, cb) {
    let sentenceArray = sentence.split(' ')
    var searchResults = [];
    async.forEachOf(sentenceArray, (value, key, callback) => {
        Words.find()
            .and([
                { next: sentenceArray[key + 1] ? sentenceArray[key + 1] : '' },
                { previous: sentenceArray[key - 1] ? sentenceArray[key - 1] : '' },
                { text: value },
                { timestamp: timestamp }
            ])
            .exec(function (err, results) {
                if (err) {
                    // cb(err, null)
                }
                else {
                    searchResults.push(results.length > 0 ? results[0] : {})
                }
            });
    }, err => {
        if (err) console.error(err.message);
        // configs is now a map of JSON data
        cb(null, searchResults)
    });

}