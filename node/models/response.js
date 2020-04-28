/**
 * handles application level response format
 */
'use strict'
var STATUSCODE = require('../errors/statuscodes').StatusCode

function Response(statuscode, data) {
    this.statuscode = statuscode;
    this.data = data;
}

function Response(statuscode, data, count, sum, pending, ner, model) {
    this.statuscode = statuscode;
    this.data = data;
    this.count = count;
    this.sum = sum
    this.pending = pending
    this.ner = ner
    this.model = model
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
    if(!isNaN(this.pending)){
        result.pending = this.pending
    }
    if(this.ner){
        result.ner = this.ner
    }
    if(this.model){
        result.model = this.model
    }
    return result
};

module.exports = Response;