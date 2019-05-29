tsv = require("node-tsv-json");
var WordDispatcher = require('./controllers/dispatch/word.dispatch');

    tsv({
        input: "upload/1558688388104_hin.tsv"
        // output: "output.json"
        //array of arrays, 1st array is column names
        , parseRows: true
    }, function (err, result) {
        if (err) {
            console.error(err);
        } else {
            //   console.log(result);
            let headers = []
            let data = []
            let no_of_data = 0
            result.map((row, index) => {
                if (index == 0) {
                    headers = row
                }
                else {
                    let obj = {}
                    row.map((column, column_index) => {
                        obj[headers[column_index]] = column
                    })
                    obj.previous = data[no_of_data - 1] ? data[no_of_data - 1].text : ''
                    obj.next = result[no_of_data + 2] ? result[no_of_data + 2][11] : ''
                    data.push(obj)
                    no_of_data++
                }
            })
            WordDispatcher.saveWords(data)
        }
    });
