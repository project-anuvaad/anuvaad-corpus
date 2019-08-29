var mysql = require('mysql')
var LOG = require('../logger/logger').logger
var APP_CONFIG = require('../config/config').config

var ConnMgr = (function () {
    var instance;
    var dbPool;
    var poolConfig = {
        connectionLimit: 10,
        host: APP_CONFIG.MYSQL_HOST,
        user: APP_CONFIG.MYSQL_USERNAME,
        password: APP_CONFIG.MYSQL_PASSWORD,
        database: APP_CONFIG.MYSQL_DB,
        typeCast: function castField(field, useDefaultTypeCasting) {

            // We only want to cast bit fields that have a single-bit in them. If the field
            // has more than one bit, then we cannot assume it is supposed to be a Boolean.
            if ((field.type === "BIT") && (field.length === 1)) {

                var bytes = field.buffer();

                // A Buffer in Node represents a collection of 8-bit unsigned integers.
                // Therefore, our single "bit field" comes back as the bits '0000 0001',
                // which is equivalent to the number 1.
                if (bytes != null)
                    return (bytes[0] === 1);
                else
                    return false;

            }

            return (useDefaultTypeCasting());

        }
    };

    function init() {
        return {
            getConnection: function (cb) {
                dbPool.getConnection((err, conn) => {
                    if (err) {
                        cb(err, null)
                    } else {
                        cb(null, conn)
                    }
                })
            },
            createDBPool: function (cb) {
                var pool = mysql.createPool(poolConfig)
                dbPool = pool;
                cb(null, pool);
            }
        }
    }

    return {
        getInstance: function () {
            if (!instance) {
                instance = init();
            }
            return instance;
        }
    }
})();

module.exports = ConnMgr;