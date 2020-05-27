/*
 * @Author: ghost 
 * @Date: 2020-05-22 16:30:44 
 * @Last Modified by: aroop.ghosh@tarento.com
 * @Last Modified time: 2020-05-22 17:14:35
 */
var LOG = require('../logger/logger').logger
var Decrypt = require('./encryt_decrypt')

var nodemailer = require('nodemailer');


function send_email(to, subject, content) {
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SUPPORT_EMAIL,
            pass: Decrypt.decrypt(process.env.SUPPORT_EMAIL_PASSWORD)
        }
    });

    const mailOptions = {
        from: process.env.SUPPORT_EMAIL, 
        to: to, // list of receivers
        subject: subject, // Subject line
        html: content// plain text body
    };

    transporter.sendMail(mailOptions, function (err, info) {
        if (err)
            LOG.error(err)
        else
            LOG.info(info);
    });
}

module.exports.send_email = send_email;
