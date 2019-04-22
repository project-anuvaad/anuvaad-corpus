// Load required packages
var passport = require('passport');
var BearerStrategy = require('passport-http-bearer').Strategy
var ApiTokenStrategy = require('passport-http-api-token-bearer')
var Users = require('../models/users');
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode

passport.use(new BearerStrategy(
    function (token, callback) {
        Users.findOneByToken(token, (err, user) => {
            if (err) {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, "auth").getRspStatus()
                return callback(apistatus, false)
            }
            if (!user || user == null) {
                let apistatus = new APIStatus(StatusCode.ERR_LOCAL_USER_INVALID_CRED, "auth").getRspStatus()
                return callback(apistatus, false)
            }
            return callback(null, user)
        })
    }
));

passport.use(new ApiTokenStrategy({
    access_token: 'x-access-token'      /// you can define custom access_token name here,
},
    function (token, callback) {
        if (token == 'SampleApiKey') {
            return callback(null, true)
        }
        else {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_FORBIDDEN, "auth").getRspStatus()
            return callback(apistatus, false)
        }
    }
));

passport.serializeUser((user, cb) => {
    cb(null, user)
})

passport.deserializeUser((user, cb) => {
    cb(null, user)
})

exports.isTokenAuthenticated = passport.authenticate('bearer', { session: false });
exports.isApiTokenAuthenticated = passport.authenticate('token-bearer', { session: false });








