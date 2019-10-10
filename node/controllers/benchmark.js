/*
 * @Author: ghost 
 * @Date: 2019-08-29 17:32:50 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2019-08-30 14:22:51
 */
var Benchmark = require('../models/benchmark');
var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode


exports.fetchBenchmark = function (req, res) {
    Benchmark.fetchAll((err, benchmarks) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, COMPONENT).getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        let response = new Response(StatusCode.SUCCESS, benchmarks).getRsp()
        return res.status(response.http.status).json(response);
    })
}