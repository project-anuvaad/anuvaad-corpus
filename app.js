// Load required packages
var express = require('express');
var helmet = require('helmet')
var bodyParser = require('body-parser');
var methodOverride = require('method-override');

var LOG = require('./logger/logger').logger
var APP_CONFIG = require('./config/config').config
var APIStatus = require('./errors/apistatus')
var PdfToImage = require('./utils/pdf_to_image')
var Corpus = require('./controllers/corpus')
var StatusCode = require('./errors/statuscodes').StatusCode
var multer = require('multer');
var upload = multer({ dest: 'upload/' });
var fs = require("fs");

process.on('SIGINT', function () {
  LOG.info("stopping the application")
  process.exit(0);
});
startApp()


function startApp() {
  var app = express();
  app.set('trust proxy', 1);

  app.use(helmet())
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true
  }));
  app.use(methodOverride());
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    if ('OPTIONS' === req.method) {
      res.sendStatus(200);
    }
    else {
      next();
    };
  });


  var router = express.Router();
  require('./routes/user/user.route')(router);

  app.get('/test', function (req, res) {
    res.send("Hello world!");
  });

  // router.route('/')
  //   .get((req, res) => {
  //     let apistatus = new APIStatus(StatusCode.SUCCESS, "app").getRspStatus()
  //     apistatus.message = "Welcome to AI Demo V1.0.0 API"
  //     return res.status(apistatus.http.status).json(apistatus);
  //   })


  // app.use('/aidemo/v1', router);


  app.post('/', upload.single('file'), function (req, res) {
    var tmp_path = req.file.path;
    var file_path = "upload/" + new Date().getTime() + ".pdf"
    fs.readFile(tmp_path, function (err, buf) {
      fs.writeFile(file_path, buf, function (err) {
        if (err) {
          let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
          return res.status(apistatus.http.status).json(apistatus);
        }
        fs.unlink(tmp_path, function () { })
        PdfToImage.convertToImage(file_path, function (imagePath) {
          req.imagePath = imagePath
          Corpus.processImage(req, res)
        });
      });
    });

  })


  app.post('/multiple', upload.array('files', 2), function (req, res) {
    var tmp_path = req.files[0].path;
    let time_stamp = new Date().getTime()
    let output_base_name = 'upload/' + time_stamp
    var file_path = "upload/" + time_stamp + '_hin' + ".pdf"
    fs.readFile(tmp_path, function (err, buf) {
      fs.writeFile(file_path, buf, function (err) {
        if (err) {
          let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
          return res.status(apistatus.http.status).json(apistatus);
        }
        fs.unlink(tmp_path, function () { })
        PdfToImage.convertToMultipleImage(file_path, function (imagePaths) {
          req.imagePaths = imagePaths
          req.type = 'hin'
          Corpus.processMultipleImage(req, res, output_base_name, function (err, imagePath) {
            var tmp_path = req.files[1].path;
            var file_path = "upload/" + time_stamp + '_eng' + ".pdf"
            fs.readFile(tmp_path, function (err, buf) {
              fs.writeFile(file_path, buf, function (err) {
                if (err) {
                  let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                  return res.status(apistatus.http.status).json(apistatus);
                }
                fs.unlink(tmp_path, function () { })
                PdfToImage.convertToMultipleImage(file_path, function (imagePaths) {
                  req.imagePaths = imagePaths
                  req.type = 'eng'
                  Corpus.processMultipleImage(req, res, output_base_name, function (err, imagePath) {
                    req.file_base_name = output_base_name
                    Corpus.convertAndCreateCorpus(req, res)
                  })
                });
              });
            });
          })
        });
      });
    });

  })

  app.use(function (err, req, res, next) {
    if (err && !err.ok) {
      console.log(err)
      return res.status(err.http.status).json(err);
    } else {
      let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, "app").getRspStatus()
      apistatus.message = "We are expriencing issues at our end, kindly try again in sometimes."
      return res.status(apistatus.http.status).json(apistatus);
    }
  });

  var server = app.listen(APP_CONFIG.PORT);
  server.timeout = 10000000;
}
