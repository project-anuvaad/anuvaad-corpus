/**
 * handles application level response format
 */
'use strict'
var STATUSCODE = require('../errors/statuscodes').StatusCode

function Response(statuscode, data) {
    this.statuscode = statuscode;
    this.data = data;
}

function Response(statuscode, data, offers) {
    this.statuscode = statuscode;
    this.data = data;
    this.offers = offers;
}

Response.prototype.getRsp = function () {
    let result = JSON.parse(JSON.stringify(this.statuscode));
    if(this.data){
        result.data = this.data;
    }
    if(this.shop){
        result.shop = this.shop;
    }
    if(this.offers){
        result.offers = this.offers;
    }
    return result
};

module.exports = Response;