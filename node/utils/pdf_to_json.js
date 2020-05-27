var axios = require('axios');
var LOG = require('../logger/logger').logger
var fs = require("fs");
const BASE_PATH = process.env.NER_BASE_URL ? process.env.NER_BASE_URL : 'http://auth.anuvaad.org'
const BASE_PATH_NGINX = 'nginx/'
var UUIDV4 = require('uuid/v4')


exports.converPdfToJson = function (filepath, cb) {
    LOG.info(filepath)
    fs.readFile(filepath, function (err, file) {
        axios.post(BASE_PATH + '/upload', file
            , {
                headers: {
                    'Content-Type': `application/pdf`,
                },
                timeout: 30000,
            }
        ).then(function (api_res) {
            axios.post(BASE_PATH + '/lines', {
                pdf_file_id: api_res.data.data.filepath
            }
                , {
                    headers: {
                        'Content-Type': `application/json`,
                    },
                    timeout: 3000000,
                }
            ).then(function (api_res) {
                let res = api_res.data
                cb(null, res.lines_data)
            }).catch((e) => {
                LOG.error(e)
                cb(e, {})
            })
        }).catch((e) => {
            LOG.error(e)
            cb(e, {})
        })
    })
}