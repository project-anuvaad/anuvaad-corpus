'use strict';
const excelToJson = require('convert-excel-to-json');

const result = excelToJson({
    sourceFile: 'Corpus2.xlsx'
});

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";

MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("preprocessing");
    var arr = []
    result['Sheet1'].map((res, index) => {
        if (res['A'] && res['A'].length > 0) {
            let obj = { source: res['A'], target: res['B'] }
            arr.push(obj)
        }
    })
    dbo.collection("oldcorpus").insertMany(arr, function (err, res) {
        if (err) throw err;
        console.log("1 document inserted");
        db.close();
    });
});

// console.log(result['Books'][0]['A'])