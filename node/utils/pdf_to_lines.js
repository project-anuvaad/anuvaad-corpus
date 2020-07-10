var axios = require('axios');
var LOG = require('../logger/logger').logger
var fs = require("fs");
const BASE_PATH = process.env.NER_BASE_URL ? process.env.NER_BASE_URL : 'https://auth.anuvaad.org'
const BASE_PATH_NGINX = 'nginx/'
var UUIDV4 = require('uuid/v4')

exports.converPdfToLines = function (filepath, cb) {
    LOG.info(filepath)
    axios.post(BASE_PATH + '/anuvaad-etl/extractor/sentence/v1/sentences/extract_lines', {
        "workflowCode": "DP_WFLOW_test",
        "jobID": "12345",
        "tool": "<tool_name>",
        "stepOrder": "<step>",
        "input": { "path": filepath }
    }
        , {
            headers: {
                'Content-Type': `application/json`,
            },
            timeout: 3000000,
        }
    ).then(function (api_res) {
        let res = api_res.data
        cb(null, res)
    }).catch((e) => {
        LOG.error(e)
        cb(e, {})
    })
}