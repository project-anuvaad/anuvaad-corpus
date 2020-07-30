const { exec } = require("child_process");
var LOG = require('../logger/logger').logger

exports.convertPdfToHtmlPagewise = function (basefolder, inputfilname, outputfilename, session_id, cb) {
    let command = "pdftohtml -p -c " + basefolder + session_id + "/" + inputfilname + " " + basefolder + session_id + "/" + outputfilename
    exec(command, (error, stdout, stderr) => {
        if (error) {
            LOG.error(error);
        }
        if (stderr) {
            LOG.error(stderr);
        }
        cb(null, 'done')
    });
}

exports.convertPdfToHtml = function (basefolder, inputfilname, outputfilename, session_id, cb) {
    let command = "pdftohtml -p -c -s " + basefolder + session_id + "/" + inputfilname + " " + basefolder + session_id + "/" + outputfilename
    exec(command, (error, stdout, stderr) => {
        if (error) {
            LOG.error(error);
        }
        if (stderr) {
            LOG.error(stderr);
        }
        cb(null, 'done')
    });
}