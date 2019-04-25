var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var fs = require("fs");
var glob = require("glob")

exports.processImage = function (req, res) {
    let imagePath = req.imagePath
    let file_base_name = imagePath.replace('.png', '')
    const { exec } = require('child_process');
    exec('tesseract ' + imagePath + ' ' + file_base_name + ' -l hin+eng', (err, stdout, stderr) => {
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        var exec_cmd = 'python separate.py ' + file_base_name + '.txt ' + file_base_name
        exec(exec_cmd, (err, stdout, stderr) => {
            if (err) {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
            const { Translate } = require('@google-cloud/translate');
            const projectId = "translate-1552888031121";
            const translate = new Translate({
                projectId: projectId,
            });
            const target = 'eng';
            fs.readFile(file_base_name + '_hin' + '.txt', 'utf8', function (err, data) {
                if (err) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                }
                translate
                    .translate(data, target)
                    .then(results => {
                        const translation = results[0];
                        fs.writeFile(file_base_name + '_eng_tran' + '.txt', translation, function (err) {
                            if (err) {
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                            let corpus_cmd = './helpers/bleualign.py -s ' + __dirname + '/../' + imagePath.replace('.png', '_hin') + '.txt' + ' -t ' + __dirname + '/../' + imagePath.replace('.png', '_eng') + '.txt' + ' --srctotarget ' + __dirname + '/../' + imagePath.replace('.png', '_eng_tran') + '.txt' + ' -o ' + __dirname + '/../' + imagePath.replace('.png', '_output')
                            exec(corpus_cmd, (err, stdout, stderr) => {
                                if (err) {
                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                                    return res.status(apistatus.http.status).json(apistatus);
                                }
                                let output_data = {}
                                fs.readFile(file_base_name + '_output-s', 'utf8', function (err, data) {
                                    output_data.hindi = data.split('\n')
                                    fs.readFile(file_base_name + '_output-t', 'utf8', function (err, data) {
                                        output_data.english = data.split('\n')
                                        glob(file_base_name + "*", function (er, files) {
                                            if(files && files.length > 0){
                                                files.map((fileName)=>{
                                                    fs.unlink(fileName, function () { })
                                                })
                                            }
                                        })
                                        let apistatus = new Response(StatusCode.SUCCESS, output_data).getRsp()
                                        return res.status(apistatus.http.status).json(apistatus);
                                    })
                                });
                            })
                        });
                    })
            });
        });
    });

}