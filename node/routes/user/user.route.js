/*
 * @Author: ghost 
 * @Date: 2018-04-10 10:59:10 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2018-06-29 10:18:27
 */
var userController = require('../../controllers/users');


module.exports = function (router) {
    router.route('/list-users')
        .get(userController.listUsers);

    router.route('/list-roles')
        .get(userController.listRoles);
}