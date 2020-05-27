/**
 * handles application level response format
 */
'use strict'
var STATUSCODE = require('../errors/statuscodes').StatusCode

function Response(statuscode, data) {
    this.statuscode = statuscode;
    this.data = data;
}

function Response(statuscode, data, count, sum, pending, ner, model, pdf_process) {
    this.statuscode = statuscode;
    this.data = data;
    this.count = count;
    this.sum = sum
    this.pending = pending
    this.ner = ner
    this.model = model
    this.pdf_process = pdf_process
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
    if(this.pdf_process){
        result.pdf_process = this.pdf_process
    }
    return result
};

module.exports = Response;