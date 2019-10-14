/**
 * handles application level response format
 */
'use strict'
var STATUSCODE = require('../errors/statuscodes').StatusCode

function Response(statuscode, data) {
    this.statuscode = statuscode;
    this.data = data;
}

function Response(statuscode, data, count, sum) {
    this.statuscode = statuscode;
    this.data = data;
    this.count = count;
    this.sum = sum
}

Response.prototype.getRsp = function () {
    let result = JSON.parse(JSON.stringify(this.statuscode));
    if(this.data){
        result.data = this.data;
    }
    if(this.count){
        result.count = this.count
    }
    if(this.sum){
        result.sum = this.sum
    }
    return result
};

module.exports = Response;