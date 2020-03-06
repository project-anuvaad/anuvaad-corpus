const htmlToJson = require('html-to-json')
const fs = require('fs');
const sentence_ends = ['.', '?', '!']
const regex = /([,|a-zA-Z]{2,}[.]$)/g;


exports.convertHtmlToJson = function (basefolder, inputfilename, session_id, cb) {
    fs.readFile(basefolder + session_id + "/" + inputfilename, 'utf8', function (err, data) {
        let output = []
        data = data.replace(/<br\/>/g, ' ')
        htmlToJson.parse(data, function () {
            return this.map('p', function ($item) {
                let obj = {}
                let style = $item['0']['attribs']['style']
                let class_identifier = $item['0']['attribs']['class']
                let styles = style.split(';')
                styles.map((s) => {
                    let topLeft = s.split(':')
                    if (topLeft[0] == 'left') {
                        obj.x = topLeft[1].split('px')[0]
                    } else if (topLeft[0] == 'top') {
                        obj.y = topLeft[1].split('px')[0]
                    }
                })
                obj.text = $item.text()
                obj.style = style
                obj['class'] = class_identifier
                return obj;
            });
        }).done(function (items) {
            items.map((it, index) => {
                if (output && output.length > 0) {
                    let data = output[output.length - 1]
                    if ((data.y == it.y || !(sentence_ends.indexOf(data.text.substring(data.text.length - 1, data.text.length)) >= 0 && data.text.search(regex) >= 0)) && index > 10) {
                        data.text += ' ' + it.text
                        data.text = data.text.replace(/\s+/g, " ")
                    } else {
                        it.text = it.text.replace(/\s+/g, " ")
                        output.push(it)
                    }
                } else {
                    output.push(it)
                }
            })
            cb(null, output)
        }, function (err) {
            cb(err, null)
        });
    })
}
