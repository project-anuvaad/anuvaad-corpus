/**
 * @author: KD
 * @description: provides app wide configs
 */
var environment     = require('./env/env.json');
var fs              = require('fs');
var path            = require('path');

var config = function() {
    // setting default to development.
    // NODE_ENV=development node server.js
    // NODE_ENV=production node server.js
    
    var node_env = process.env.NODE_ENV || 'local';
    if(node_env === 'local') {
        var filePath        = path.join(__dirname, './env/local.json');
        var localEnv        = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return localEnv[node_env];
    } else {
        return environment[node_env];
    }
};

exports.config = config();
