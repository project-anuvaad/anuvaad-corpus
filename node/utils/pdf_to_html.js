const { exec } = require("child_process");
var LOG = require('../logger/logger').logger

exports.convertPdfToHtml = function (basefolder, inputfilname, outputfilename, session_id, cb) {
    let command = "pdftohtml -p -c -s " + basefolder + session_id + "/" + inputfilname + " " + basefolder + session_id + "/" + outputfilename
    exec(command, (error, stdout, stderr) => {
        if (error) {
            LOG.error(error);
            cb(error, null)
        }
        if (stderr) {
            LOG.error(stderr);
            cb(stderr, null)
        }
        cb(null, 'done')
    });
}