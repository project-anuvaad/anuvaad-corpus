var axios = require('axios');
var LOG = require('../logger/logger').logger
var fs = require("fs");
const BASE_PATH = process.env.NER_BASE_URL ? process.env.NER_BASE_URL : 'https://auth.anuvaad.org'
const BASE_PATH_NGINX = 'nginx/'
var UUIDV4 = require('uuid/v4')

exports.converPdfToLines = function (filepath, cb) {
    LOG.info(filepath)
    // fs.readFile(BASE_PATH_NGINX + '/' + filepath, function (err, file) {
    //     axios.post(BASE_PATH + '/upload', file
    //         , {
    //             headers: {
    //                 'Content-Type': `application/pdf`,
    //             },
    //             timeout: 30000,
    //         }
    //     ).then(function (api_res) {
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
                let data = res.output
                let node_index = 0
                Object.keys(data).forEach(function (key, index) {
                    data[key].html_nodes.map((html_node)=>{
                        html_node.y_end = html_node.y
                        html_node.node_index = node_index
                        html_node.page_no_end = html_node.page_no
                        node_index++
                    })
                })
                cb(null, data)
            }).catch((e) => {
                LOG.error(e)
                cb(e, {})
            })
    //     }).catch((e) => {
    //         LOG.error(e)
    //         cb(e, {})
    //     })
    // })
}