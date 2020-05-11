var axios = require('axios');
var LOG = require('../logger/logger').logger
var fs = require("fs");
const BASE_PATH = 'http://auth.anuvaad.org'
const BASE_PATH_NGINX = 'nginx/'
var UUIDV4 = require('uuid/v4')


exports.processImage = function (filepath, filename, cb) {
    LOG.info(filepath)
    let file_name_with_uuid = UUIDV4() + filename
    fs.copyFile(filepath, BASE_PATH_NGINX + file_name_with_uuid, function (err) {
        if (err) {
            LOG.error(e)
            cb(null, {})
        } else {
            axios.post(BASE_PATH + '/extract', {
                image_file_id: file_name_with_uuid
            }
                , {
                    headers: {
                        'Content-Type': `application/json`,
                    },
                    timeout: 30000,
                }
            ).then(function (api_res) {
                let res = api_res.data
                if (res && res.lines && res.lines.length > 0) {
                    let lines = res.lines
                    lines.sort((a, b) => b.y - a.y)
                    res.lines = lines
                } if (res && res.tables && res.tables.length > 0) {
                    let tables = res.tables
                    tables.map((table, index) => {
                        let rect = table.rect
                        rect.sort((a, b) => {
                            if (a.y == b.y) {
                                return b.x - a.x
                            } else {
                                return b.y - a.y
                            }

                        })
                        table.rect = rect
                        tables[index] = table
                    })

                    res.tables = tables
                }
                cb(null, res)
            }).catch((e) => {
                LOG.error(e)
                cb(null, {})
            })
        }
    })
    // fs.readFile(filepath, function (err, file) {
    //     axios.post(BASE_PATH + '/upload', file
    //         , {
    //             headers: {
    //                 'Content-Type': `image/png`,
    //             },
    //             timeout: 30000,
    //         }
    //     ).then(function (api_res) {
    //         axios.post(BASE_PATH + '/imageprocessing/api/v1/rect/extract', {
    //             image_file_id: api_res.data.filepath
    //         }
    //             , {
    //                 headers: {
    //                     'Content-Type': `application/json`,
    //                 },
    //                 timeout: 30000,
    //             }
    //         ).then(function (api_res) {
    //             let res = api_res.data
    //             if (res && res.lines && res.lines.length > 0) {
    //                 let lines = res.lines
    //                 lines.sort((a, b) => b.y - a.y)
    //                 res.lines = lines
    //             } if (res && res.tables && res.tables.length > 0) {
    //                 let tables = res.tables
    //                 tables.map((table, index) => {
    //                     let rect = table.rect
    //                     rect.sort((a, b) => {
    //                         if (a.y == b.y) {
    //                             return b.x - a.x
    //                         } else {
    //                             return b.y - a.y
    //                         }

    //                     })
    //                     table.rect = rect
    //                     tables[index] = table
    //                 })

    //                 res.tables = tables
    //             }
    //             cb(null, res)
    //         }).catch((e) => {
    //             LOG.error(e)
    //             cb(null, {})
    //         })
    //     }).catch((e) => {
    //         cb(null, {})
    //     })
    // })
}