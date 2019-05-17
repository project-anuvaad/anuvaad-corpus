const http = require('http');
const fs = require('fs');
downloadFile(194518, 203929)

function downloadFile(index, max) {
    http.get(`http://egazette.nic.in/WriteReadData/2019/${index}.pdf`, function (response) {
        if (response.statusCode !== 404) {
            const file = fs.createWriteStream(`egag/${index}.pdf`);
            response.pipe(file);
        }
        index++
        if (index != max) {
            downloadFile(index, max)
        }
    }).on('error', function (e) {
        console.log("error: ", e);
        index++
        if (index != max) {
            downloadFile(index, max)
        }
    });
}