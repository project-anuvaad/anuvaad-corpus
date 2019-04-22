// Load required packages
var express = require('express');
var helmet = require('helmet')
var bodyParser = require('body-parser');
var methodOverride = require('method-override');

var LOG = require('./logger/logger').logger
var APP_CONFIG = require('./config/config').config
var APIStatus = require('./errors/apistatus')
var StatusCode = require('./errors/statuscodes').StatusCode
var multer = require('multer');
var upload = multer({ dest: 'upload/' });
var fs = require("fs");
var PDFImage = require("pdf-image").PDFImage;
var Response = require('./models/response')

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
          return console.log(err);
        }
        fs.unlink(tmp_path, function () { })
        console.log("The file was saved!");
        var pdfImage = new PDFImage(file_path, {
          convertOptions: {
            '-background': 'white',
            '-density': '300',
            '-flatten': ''
          }
        });
        var pageNumber = 0, image_paths = [];
        saveToFile(pageNumber, image_paths, pdfImage, res)
      });
    });

  })

  function saveToFile(pageNumber, image_paths, pdfImage, res) {
    pdfImage.convertPage(pageNumber).then(function (imagePath) {
      // 0-th page (first page) of the slide.pdf is available as slide-0.png
      pageNumber = pageNumber + 1
      saveToFile(pageNumber, image_paths, pdfImage, res)
      image_paths.push(imagePath)
      // fs.existsSync(imagePath) // => true
    }).catch(function (e) {
      console.log(e)
      pdfImage.combineImages(image_paths).then(function (imagePath) {
        console.log(imagePath)
        const { exec } = require('child_process');
        exec('tesseract ' + imagePath + ' ' + imagePath.replace('.png', '') + ' -l hin+eng', (err, stdout, stderr) => {
          if (err) {
            // node couldn't execute the command
            return;
          }

          // the *entire* stdout and stderr (buffered)
          console.log(`stdout: ${stdout}`);
          console.log(`stderr: ${stderr}`);
          fs.readFile(imagePath.replace('.png', '.txt'), 'utf8', function (err, data) {
            data = data.replace(/(\r\n|\n|\r)/gm, " ");
            fs.writeFile(imagePath.replace('.png', '.txt'), data, function (err) {
              var exec_cmd = 'python separate.py ' + imagePath.replace('.png', '.txt') + ' ' + imagePath.replace('.png', '')
              console.log(exec_cmd)
              exec(exec_cmd, (err, stdout, stderr) => {
                if (err) {
                  // node couldn't execute the command
                  let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                  return res.status(apistatus.http.status).json(apistatus);
                }
                const { Translate } = require('@google-cloud/translate');

                // Create client for prediction service.

                /**
                 * TODO(developer): Uncomment the following line before running the sample.
                 */
                const projectId = "translate-1552888031121";
                const translate = new Translate({
                  projectId: projectId,
                });

                // The text to translate
                // The target language
                const target = 'eng';

                // Translates some text into English

                fs.readFile(imagePath.replace('.png', '_hin') + '.txt', 'utf8', function (err, data) {
                  if (err) {
                    let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                    return res.status(apistatus.http.status).json(apistatus);
                  }
                  translate
                    .translate(data, target)
                    .then(results => {
                      const translation = results[0];
                      fs.writeFile(imagePath.replace('.png', '_eng_tran') + '.txt', translation, function (err) {
                        if (err) {
                          let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
                          return res.status(apistatus.http.status).json(apistatus);
                        }
                        console.log('Saved!');
                        let corpus_cmd = './helpers/bleualign.py -s ' + __dirname + '/' + imagePath.replace('.png', '_hin') + '.txt' + ' -t ' + __dirname + '/' + imagePath.replace('.png', '_eng') + '.txt' + ' --srctotarget ' + __dirname + '/' + imagePath.replace('.png', '_eng_tran') + '.txt' + ' -o ' + __dirname + '/' + imagePath.replace('.png', '_output')
                        exec(corpus_cmd, (err, stdout, stderr) => {
                          if (err) {
                            console.log(err)
                            // node couldn't execute the command
                            return;
                          }
                          let output_data = {}
                          fs.readFile(imagePath.replace('.png', '_output-s'), 'utf8', function (err, data) {
                            output_data.hindi = data.split('\n')
                            fs.readFile(imagePath.replace('.png', '_output-t'), 'utf8', function (err, data) {
                              output_data.english = data.split('\n')
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
          });


        });
      });
    });
  }

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

  app.listen(APP_CONFIG.PORT);
}
