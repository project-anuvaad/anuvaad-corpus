var lineReader = require('line-reader');
var fs = require("fs");
var hin = []
var hin_clean = []
var eng_clean = []
var hin_remaining = []
var eng_remaining = []
var eng = []
var indexes = []
var commission = []
lineReader.eachLine('upload/hin.txt', function (line, last) {
    hin.push(line);
    // do whatever you want with line...
    if (last) {
        lineReader.eachLine('upload/eng.txt', function (line, last) {
            eng.push(line);
            // do whatever you want with line...
            if (last) {
                lineReader.eachLine('upload/src-law_commision_100519.txt', function (line, last) {
                    commission.push(line);
                    // do whatever you want with line...
                    if (last) {
                        console.log(commission.length)
                        hin = hin.filter(function (val, index) {
                            if (commission.indexOf(val) != -1) {
                                indexes.push(index)
                            }
                            return true;
                        });
                        for (var i = 0; i < indexes.length; i++) {
                            hin_remaining.push(hin[indexes[i]])
                            eng_remaining.push(eng[indexes[i]])
                            hin[indexes[i]] = ''
                            eng[indexes[i]] = ''
                        }
                        for(var i=0;i<hin.length;i++){
                            if(hin[i].length>0){
                                hin_clean.push(hin[i])
                                eng_clean.push(eng[i])
                            }
                            
                        }
                        fs.writeFile('upload/hin_remaining.txt', hin_remaining.join('\n'), function (err) {
                            fs.writeFile('upload/eng_remaining.txt', eng_remaining.join('\n'), function (err) {
                                fs.writeFile('upload/hin_clean.txt', hin_clean.join('\n'), function (err) {
                                    fs.writeFile('upload/eng_clean.txt', eng_clean.join('\n'), function (err) {
                                    })
                                })
                            })
                        })
                        console.log(indexes.length)
                    }
                });
            }
        });
    }
});
