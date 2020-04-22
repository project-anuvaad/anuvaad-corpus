var axios = require('axios');
var LOG = require('../logger/logger').logger
var fs = require("fs");
const BASE_PATH = 'http://52.11.90.50'


exports.processImage = function (filepath, cb) {
    LOG.info(filepath)
    fs.readFile(filepath, function (err, file) {
        axios.post(BASE_PATH + '/upload', file
            , {
                headers: {
                    'Content-Type': `image/png`,
                },
                timeout: 30000,
            }
        ).then(function (api_res) {
            axios.post(BASE_PATH + '/api/v1/rect/extract', {
                image_file_id: api_res.data.filepath
            }
                , {
                    headers: {
                        'Content-Type': `application/json`,
                    },
                    timeout: 30000,
                }
            ).then(function (api_res) {
                let res = api_res.data.response
                if (res && res.lines && res.lines.length > 0) {
                    let lines = res.lines
                    lines.sort((a, b) => b.y - a.y)
                    res.lines = lines
                }
                cb(null, api_res.data.response)
            }).catch((e) => {
                LOG.error(e)
                cb(null, {})
            })
        }).catch((e) => {
            cb(null, {})
        })
    })
}