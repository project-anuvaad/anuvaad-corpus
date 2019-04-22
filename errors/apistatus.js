/**
 * handles application level error messages
 */
'use strict'
var STATUSCODE = require('./statuscodes').StatusCode

function APIStatus(statuscode, component, language) {
    this.statuscode = statuscode;
    this.component = component;
    this.language = language;
}

APIStatus.prototype.getRspStatus = function () {
    let result = JSON.parse(JSON.stringify(this.statuscode));
    result.component = this.component
    return result
};

module.exports = APIStatus;