var Response = require('../models/response')
var APIStatus = require('../errors/apistatus')
var StatusCode = require('../errors/statuscodes').StatusCode
var fs = require("fs");
var glob = require("glob")
const { exec } = require('child_process');

const python_version = 'python'

const { Translate } = require('@google-cloud/translate');
const projectId = "translate-1552888031121";
const translate = new Translate({
    projectId: projectId,
});
const target = 'eng';

exports.processImage = function (req, res, dontSendRes) {
    let imagePaths = req.image_paths
    let file_base_name = imagePaths[0].replace('.png', '').split('-')[0]
    callTesseractForMultipleLanguage(imagePaths, 0, res, file_base_name, dontSendRes)
}


function callTesseractForMultipleLanguage(imagePaths, index, res, file_base_name, dontSendRes) {
    exec('tesseract ' + imagePaths[index] + ' - >> ' + file_base_name + '.txt -l hin+eng', (err, stdout, stderr) => {
        index++;
        if (err) {
            if (!dontSendRes) {
                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                return res.status(apistatus.http.status).json(apistatus);
            }
        }

        if (index == imagePaths.length) {
            var exec_cmd = python_version + ' separate.py ' + file_base_name + '.txt ' + file_base_name
            exec(exec_cmd, (err, stdout, stderr) => {
                if (err) {
                    if (!dontSendRes) {
                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                        return res.status(apistatus.http.status).json(apistatus);
                    }
                }
                var exec_cmd = python_version + ' ' + 'process_paragraph.py' + ' ' + file_base_name + '_hin.txt ' + file_base_name
                exec(exec_cmd, (err, stdout, stderr) => {
                    if (err) {
                        if (!dontSendRes) {
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        }
                    }
                    var exec_cmd = python_version + ' ' + 'process_paragraph_eng.py' + ' ' + file_base_name + '_eng.txt ' + file_base_name
                    exec(exec_cmd, (err, stdout, stderr) => {
                        if (err) {
                            if (!dontSendRes) {
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                        }

                        fs.readFile(file_base_name + '_hin' + '.txt', 'utf8', function (err, data) {
                            if (err) {
                                if (!dontSendRes) {
                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                                    return res.status(apistatus.http.status).json(apistatus);
                                }
                            }
                            let data_arr = data.split('\n')
                            if (data_arr.length > 20) {
                                let loops = Math.ceil(data_arr.length / 20)
                                let translated_text = ''
                                transalteBigText(0, loops, data_arr, res, translated_text, file_base_name, dontSendRes)
                            }
                            else {
                                translate
                                    .translate(data, target)
                                    .then(results => {
                                        const translation = results[0];
                                        fs.writeFile(file_base_name + '_eng_tran' + '.txt', translation, function (err) {
                                            if (err) {
                                                if (!dontSendRes) {
                                                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                                                    return res.status(apistatus.http.status).json(apistatus);
                                                }
                                            }
                                            let output_file_base = new Date().getTime()
                                            let corpus_cmd = './helpers/bleualign.py -s ' + __dirname + '/../' + file_base_name + '_hin' + '.txt' + ' -t ' + __dirname + '/../' + file_base_name + '_eng' + '.txt' + ' --srctotarget ' + __dirname + '/../' + file_base_name + '_eng_tran' + '.txt' + ' -o ' + __dirname + '/../upload/' + output_file_base + '_output'
                                            exec(corpus_cmd, (err, stdout, stderr) => {
                                                if (err) {
                                                    if (!dontSendRes) {
                                                        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                                                        return res.status(apistatus.http.status).json(apistatus);
                                                    }
                                                }
                                                let output_data = {}
                                                fs.readFile('upload/' + output_file_base + '_output' + '-s', 'utf8', function (err, data) {
                                                    output_data.hindi = data.split('\n')
                                                    fs.readFile('upload/' + output_file_base + '_output' + '-t', 'utf8', function (err, data) {
                                                        output_data.english = data.split('\n')
                                                        glob(file_base_name + "*", function (er, files) {
                                                            if (files && files.length > 0) {
                                                                files.map((fileName) => {
                                                                    fs.unlink(fileName, function () { })
                                                                })
                                                            }
                                                        })
                                                        if (!dontSendRes) {
                                                            let apistatus = new Response(StatusCode.SUCCESS, output_data).getRsp()
                                                            return res.status(apistatus.http.status).json(apistatus);
                                                        }
                                                    })
                                                });
                                            })
                                        });
                                    })
                                    .catch((e)=>{
                                        console.log(e)
                                    })
                            }
                        })
                    })
                });
            });
        }
        else {
            callTesseractForMultipleLanguage(imagePaths, index, res, file_base_name, dontSendRes)
        }
    });

}


exports.convertAndCreateCorpus = function (req, res) {
    let file_base_name = req.file_base_name
    const { Translate } = require('@google-cloud/translate');
    const projectId = "translate-1552888031121";
    const translate = new Translate({
        projectId: projectId,
    });
    const target = 'eng';
    fs.readFile(file_base_name + '_hin' + '.txt', 'utf8', function (err, data) {
        let data_arr = data.split('\n')
        if (err) {
            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
            return res.status(apistatus.http.status).json(apistatus);
        }
        if (data_arr.length > 20) {
            let loops = Math.ceil(data_arr.length / 20)
            let translated_text = ''
            transalteBigText(0, loops, data_arr, res, translated_text, file_base_name)
        }
        else {
            translate
                .translate(data.split('\n'), target)
                .then(results => {
                    let translated_text = ''
                    let translations = Array.isArray(results) ? results : [results];
                    translations.forEach((translation, i) => {
                        translated_text += translation + '\n';
                    });
                    fs.writeFile(file_base_name + '_eng_tran' + '.txt', translated_text, function (err) {
                        if (err) {
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        }
                        let corpus_cmd = './helpers/bleualign.py -s ' + __dirname + '/../' + file_base_name + '_hin' + '.txt' + ' -t ' + __dirname + '/../' + file_base_name + '_eng' + '.txt' + ' --srctotarget ' + __dirname + '/../' + file_base_name + '_eng_tran' + '.txt' + ' -o ' + __dirname + '/../' + file_base_name + '_output'
                        console.log(corpus_cmd)
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
                                        if (files && files.length > 0) {
                                            files.map((fileName) => {
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
                }).catch((e) => {
                    console.log(e)
                })
        }
    });
}


function transalteBigText(i, loops, data_arr, res, translated_text, file_base_name, dontSendRes) {
    let endCount = 20 > data_arr.length ? data_arr.length % 20 : 20
    translate
        .translate(data_arr.splice(0, endCount), target)
        .then(results => {
            let translations = Array.isArray(results[0]) ? results[0] : [results[0]];
            translations.forEach((translation, i) => {
                translated_text += translation + '\n';
            });
            if (i + 1 == loops) {
                fs.writeFile(file_base_name + '_eng_tran' + '.txt', translated_text, function (err) {
                    if (err) {
                        if (!dontSendRes) {
                            let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                            return res.status(apistatus.http.status).json(apistatus);
                        }
                    }
                    let output_file_base = new Date().getTime()
                    let corpus_cmd = './helpers/bleualign.py -s ' + __dirname + '/../' + file_base_name + '_hin' + '.txt' + ' -t ' + __dirname + '/../' + file_base_name + '_eng' + '.txt' + ' --srctotarget ' + __dirname + '/../' + file_base_name + '_eng_tran' + '.txt' + ' -o ' + __dirname + '/../upload/' + output_file_base + '_output'
                    console.log(corpus_cmd)
                    exec(corpus_cmd, (err, stdout, stderr) => {
                        if (err) {
                            console.log(err)
                            if (!dontSendRes) {
                                let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                                return res.status(apistatus.http.status).json(apistatus);
                            }
                        }
                        let output_data = {}
                        fs.readFile('upload/' + output_file_base + '_output' + '-s', 'utf8', function (err, data) {
                            output_data.hindi = data.split('\n')
                            fs.readFile('upload/' + output_file_base + '_output' + '-t', 'utf8', function (err, data) {
                                output_data.english = data.split('\n')
                                glob(file_base_name + "*", function (er, files) {
                                    if (files && files.length > 0) {
                                        files.map((fileName) => {
                                            fs.unlink(fileName, function () { })
                                        })
                                    }
                                })
                                if (!dontSendRes) {
                                    let apistatus = new Response(StatusCode.SUCCESS, output_data).getRsp()
                                    return res.status(apistatus.http.status).json(apistatus);
                                }
                            })
                        });
                    })
                });
            }
            else {
                i = i + 1;
                transalteBigText(i, loops, data_arr, res, translated_text, file_base_name, dontSendRes)
            }
        }).catch((e) => {
            console.log(e)
        })
}



exports.processMultipleImage = function (req, res, output_base_name, cb) {
    let imagePaths = req.imagePaths
    callTesseract(imagePaths, 0, req, res, output_base_name, cb)
    // for (var index = 0; index < imagePaths.length; index++) {
    //     // imagePaths.map((imagePath, index) => {
    //         if (index % 5 == 0) {
    //             await sleep(10000)
    //         }
    //         let file_base_name = imagePaths[index].replace('.png', '').split('-')[0]
    //         exec('tesseract ' + imagePaths[index] + ' - >> ' + file_base_name + '.txt' + ' -l hin+eng', (err, stdout, stderr) => {
    //             tesseract_run++;
    //             if (err) {
    //                 cb(err, null)
    //             }
    //             if (tesseract_run == imagePaths.length) {
    //                 var exec_cmd = python_version + ' ' + (req.type === 'hin' ? 'process_paragraph.py' : 'process_paragraph_eng.py') + ' ' + file_base_name + '.txt ' + output_base_name
    //                 exec(exec_cmd, (err, stdout, stderr) => {
    //                     if (err) {
    //                         cb(err, null)
    //                     }
    //                     cb(null, file_base_name + '.txt')
    //                 })
    //             }
    //         });
    //     // })
    // }

}

exports.filterCorpusText = function (req, type, cb) {
    var file_base_name = req.file_base_name + '_' + type
    var exec_cmd = python_version + ' ' + 'remove_page_number_filter.py' + ' ' + file_base_name + '.txt ' + file_base_name
    exec(exec_cmd, (err, stdout, stderr) => {
        if (err) {
            cb(err, null)
        }
        var exec_cmd = python_version + ' ' + (type === 'hin' ? 'process_paragraph.py' : 'process_paragraph_eng.py') + ' ' + file_base_name + '_filtered.txt ' + req.file_base_name
        console.log(exec_cmd)
        exec(exec_cmd, (err, stdout, stderr) => {
            if (err) {
                cb(err, null)
            }
            cb(null, file_base_name + '.txt')
        })
    })
}


function callTesseract(imagePaths, index, req, res, output_base_name, cb) {
    let file_base_name = imagePaths[index].replace('.png', '').split('-')[0]
    exec('tesseract ' + imagePaths[index] + ' - >> ' + file_base_name + '.txt' + ' -l hin+eng', (err, stdout, stderr) => {
        index++;
        if (err) {
            cb(err, null)
        }
        if (index == imagePaths.length) {
            var exec_cmd = python_version + ' ' + 'remove_page_number_filter.py' + ' ' + file_base_name + '.txt ' + file_base_name
            exec(exec_cmd, (err, stdout, stderr) => {
                if (err) {
                    cb(err, null)
                }
                var exec_cmd = python_version + ' ' + (req.type === 'hin' ? 'process_paragraph.py' : 'process_paragraph_eng.py') + ' ' + file_base_name + '_filtered.txt ' + output_base_name
                exec(exec_cmd, (err, stdout, stderr) => {
                    if (err) {
                        cb(err, null)
                    }
                    cb(null, file_base_name + '.txt')
                })
            })

        }
        else {
            callTesseract(imagePaths, index, req, res, output_base_name, cb)
        }
    });
}
