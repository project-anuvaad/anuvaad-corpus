var axios = require('axios');
var LOG = require('../logger/logger').logger
const NMT_BASE_URL = process.env.NMT_URL ? process.env.NMT_URL : 'https://auth.anuvaad.org'
var UUIDV4 = require('uuid/v4')


exports.translateFromAnuvaad = function (sentences, url_end_point, cb) {
    LOG.info(NMT_BASE_URL + '/' + (url_end_point ? url_end_point : 'translate-anuvaad'))
    axios.post(NMT_BASE_URL + '/' + (url_end_point ? url_end_point : 'translate-anuvaad'),
        sentences
        , {
            headers: {
                'Content-Type': `application/json`,
                'Authorization':'Bearer a30b0a4766fb418d863a0c2facede4e6|839ceaef0b054bb19034943975a0fb56'
            },
            timeout: 30000,
        }
    ).then(function (api_res) {
        LOG.info(api_res)
        if (api_res && api_res.data && api_res.data.response_body) {
            cb(null, api_res.data.response_body)
        } else {
            cb('error', null)
        }
    }).catch(e => {
        LOG.error(e)
        cb(e, null)
    })
}