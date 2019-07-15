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
var async = require('async')
var _ = require('lodash');
var fs = require("fs");
// Imports the Google Cloud client library
const { Storage } = require('@google-cloud/storage');

// Creates a client
const storage = new Storage();

// Imports the Google Cloud client libraries
const vision = require('@google-cloud/vision').v1;

const automl = require(`@google-cloud/automl`).v1beta1;
const { Translate } = require('@google-cloud/translate');

// Create client for prediction service.
const clientPred = new automl.PredictionServiceClient();

/**
 * TODO(developer): Uncomment the following line before running the sample.
 */
const projectId = "translate-1552888031121";
const computeRegion = "us-central1";
const modelId = "TRL3776294168538164590";
const translationAllowFallback = "False";

const GOOGLE_BUCKET_NAME = 'nlp-nmt'

// Creates a client
const client = new vision.ImageAnnotatorClient();

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


  app.post('/hin', async (req, res) => {
    let text = req.body.text;

    try {
      // Instantiates a client
      const translate = new Translate({
        projectId: projectId,
      });

      // The text to translate
      // The target language
      const target = 'eng';

      // Translates some text into English
      translate
        .translate(text, target)
        .then(results => {
          const translation = results[0];

          console.log(`Text: ${text}`);
          console.log(`Translation: ${translation}`);
          return res.status(200).json(translation);
        })
        .catch(err => {
          return res.status(200).json(err);
        });
    }
    catch (e) {
      console.log(e)
      return res.status(200).json(e);
    }
  })

  app.post('/eng', (req, res) => {
    let text = req.body.text;

    try {
      // Instantiates a client
      const translate = new Translate({
        projectId: projectId,
      });

      // The text to translate
      // The target language
      const target = 'hin';

      // Translates some text into English
      translate
        .translate(text, target)
        .then(results => {
          const translation = results[0];

          console.log(`Text: ${text}`);
          console.log(`Translation: ${translation}`);
          return res.status(200).json(translation);
        })
        .catch(err => {
          return res.status(200).json(err);
        });
    }
    catch (e) {
      console.log(e)
      return res.status(200).json(e);
    }
  })

  app.post('/tamil', (req, res) => {
    let text = req.body.text;

    try {
      // Instantiates a client
      const translate = new Translate({
        projectId: projectId,
      });

      // The text to translate
      // The target language
      const target = 'ta';

      // Translates some text into English
      translate
        .translate(text, target)
        .then(results => {
          const translation = results[0];

          console.log(`Text: ${text}`);
          console.log(`Translation: ${translation}`);
          return res.status(200).json(translation);
        })
        .catch(err => {
          return res.status(200).json(err);
        });
    }
    catch (e) {
      console.log(e)
      return res.status(200).json(e);
    }
  })

  // router.route('/')
  //   .get((req, res) => {
  //     let apistatus = new APIStatus(StatusCode.SUCCESS, "app").getRspStatus()
  //     apistatus.message = "Welcome to AI Demo V1.0.0 API"
  //     return res.status(apistatus.http.status).json(apistatus);
  //   })


  // app.use('/aidemo/v1', router);


  app.post('/old', upload.single('file'), function (req, res) {
    var tmp_path = req.file.path;
    var file_path = "upload/" + new Date().getTime() + ".pdf"
    fs.readFile(tmp_path, function (err, buf) {
      fs.writeFile(file_path, buf, function (err) {
        if (err) {
          let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
          return res.status(apistatus.http.status).json(apistatus);
        }
        fs.unlink(tmp_path, function () { })
        PdfToImage.convertToImage(file_path, function (image_paths) {
          req.image_paths = image_paths
          Corpus.processImage(req, res)
        });
      });
    });

  })

  function processFiles(req, res, base_path) {
    let time_stamp = new Date().getTime()
    async.parallel({
      one: function (callback) {
        var data = '';
        readFiles(`upload/results/${base_path}/hi/`, function (filename, content) {
          fs.writeFile('upload/' + time_stamp + '_hin.txt', content, function (err) {
            if (err) {
              console.log(err)
            }
            req.file_base_name = 'upload/' + time_stamp
            req.type = 'hin'
            Corpus.filterCorpusText(req, 'hin', function (err, imagePath) {
              callback(null, imagePath)
            })
          })
        }, function (err) {
          console.log(err)
          throw err;
        });
      },
      two: function (callback) {
        readFiles(`upload/results/${base_path}/en/`, function (filename, content) {
          fs.writeFile('upload/' + time_stamp + '_eng.txt', content, function (err) {
            if (err) {
              console.log(err)
            }
            req.file_base_name = 'upload/' + time_stamp
            req.type = 'eng'
            Corpus.filterCorpusText(req, 'eng', function (err, imagePath) {
              callback(null, imagePath)
            })
          })
        }, function (err) {
          console.log(err)
          throw err;
        });
      }
    }, function (err, results) {
      req.file_base_name = 'upload/' + time_stamp
      Corpus.convertAndCreateCorpus(req, res)
    })
  }


  function readFiles(dirname, onFileContent, onError) {
    let text_data = ''
    let count = 0
    fs.readdir(dirname, function (err, filenames) {
      if (err) {
        onError(err);
        return;
      }
      readFile(filenames, dirname, onFileContent, onError, count, text_data)
    });
  }

  function readFile(filenames, dirname, onFileContent, onError, count, text_data) {
    fs.readFile(dirname + filenames[count], 'utf-8', function (err, content) {
      count = count + 1
      if (err) {
        onError(err);
        return;
      }
      let data = JSON.parse(content);
      data.responses.map((response) => {
        var confidence_score = _.get(response, 'fullTextAnnotation.pages[0].blocks[0].confidence', [0])
        if (confidence_score > .9) {
          text_data += response.fullTextAnnotation.text
        }
      });
      if (count == filenames.length)
        onFileContent(filenames, text_data);
      else
        readFile(filenames, dirname, onFileContent, onError, count, text_data)
    });
  }

  app.post('/multiple-goo', upload.array('files', 2), function (req, res) {
    let time_stamp = new Date().getTime()
    async.parallel({
      hin: function (callback) {
        saveToBucket(req, res, 'hi', req.files[0].path, time_stamp + '_hin.pdf', time_stamp, callback)
      },
      eng: function (callback) {
        saveToBucket(req, res, 'en', req.files[1].path, time_stamp + '_eng.pdf', time_stamp, callback)
      }
    }, function (err, results) {
      async.parallel({
        hin: function (callback) {
          saveFromBucket(results, time_stamp, 'hi', results.hin, callback)
        },
        eng: function (callback) {
          saveFromBucket(results, time_stamp, 'en', results.eng, callback)
        }
      }, function (err, results) {
        processFiles(req, res, time_stamp)
      })
    });
  })

  async function saveFromBucket(results, time_stamp, type, prefix, callback) {
    const options = {
      // The path to which the file should be downloaded, e.g. "./file.txt"
      prefix: prefix,
    };
    const [files] = await storage.bucket(GOOGLE_BUCKET_NAME).getFiles(options).catch((e) => {
      console.log(e)
    });
    let count = 0;
    files.map((file, index) => {
      if (!fs.existsSync('upload/results/' + time_stamp))
        fs.mkdirSync('upload/results/' + time_stamp)
      if (!fs.existsSync('upload/results/' + time_stamp + '/' + type + '/'))
        fs.mkdirSync('upload/results/' + time_stamp + '/' + type + '/')
      fs.open('upload/' + file.name, 'w', function (err, file2) {
        if (err) throw err;
        storage
          .bucket(GOOGLE_BUCKET_NAME)
          .file(file.name)
          .download({
            // The path to which the file should be downloaded, e.g. "./file.txt"
            destination: 'upload/' + file.name,
          })
          .then(() => {
            count = count + 1
            if (count == files.length)
              callback()
          })
          .catch((e) => {
            console.log(e)
          });
      });

    });
  }

  function saveToBucket(req, res, languageHints, tmp_path, fileName, time_stamp, callback) {
    const bucketName = GOOGLE_BUCKET_NAME;
    // Uploads a local file to the bucket
    storage.bucket(bucketName).upload(tmp_path, {
      // Support for HTTP requests made with `Accept-Encoding: gzip`
      // gzip: true,
      destination: fileName,
      // By setting the option `destination`, you can change the name of the
      // object you are uploading to a bucket.
      metadata: {
        // Enable long-lived HTTP caching headers
        // Use only if the contents of the file will never change
        // (If the contents will change, use cacheControl: 'no-cache')
        // cacheControl: 'public, max-age=31536000',
        contentType: 'application/pdf'
      },
    }).then(async () => {
      // Path to PDF file within bucket
      console.log(fileName)
      // The folder to store the results
      const outputPrefix = `results/${time_stamp}/${languageHints}`

      // const gcsSourceUri = `gs://${bucketName}/${fileName}`;
      const gcsSourceUri = `gs://${bucketName}/${fileName}`;
      const gcsDestinationUri = `gs://${bucketName}/${outputPrefix}/`;

      const inputConfig = {
        // Supported mime_types are: 'application/pdf' and 'image/tiff'
        mimeType: 'application/pdf',
        gcsSource: {
          uri: gcsSourceUri,
        },
      };
      const outputConfig = {
        gcsDestination: {
          uri: gcsDestinationUri,
        },
      };
      const features = [{ type: 'DOCUMENT_TEXT_DETECTION', languageHints: 'hi' }];
      const request = {
        requests: [
          {
            inputConfig: inputConfig,
            features: features,
            imageContext: {
              languageHints: [languageHints],
            },
            outputConfig: outputConfig,
          },
        ],
      };

      const [operation] = await client.asyncBatchAnnotateFiles(request);
      const [filesResponse] = await operation.promise();
      const destinationUri =
        filesResponse.responses[0].outputConfig.gcsDestination.uri;
      console.log('Json saved to: ', destinationUri);
      fs.unlink(tmp_path, function () { })
      callback(null, outputPrefix);
    }).catch((e) => {
      console.log(e)
    });
  }


  app.post('/multiple', upload.array('files', 2), function (req, res) {
    let time_stamp = new Date().getTime()
    let output_base_name = 'upload/' + time_stamp
    async.parallel({
      hin: function (callback) {
        var tmp_path = req.files[0].path;
        var file_path = "upload/" + time_stamp + '_hin' + ".pdf"
        fs.readFile(tmp_path, function (err, buf) {
          fs.writeFile(file_path, buf, function (err) {
            if (err) {
              callback(err, null)
            }
            fs.unlink(tmp_path, function () { })
            PdfToImage.convertToMultipleImage(file_path, function (imagePaths) {
              req.imagePaths = imagePaths
              req.type = 'hin'
              Corpus.processMultipleImage(req, res, imagePaths, 'hin', output_base_name, function (err, imagePath) {
                callback()
              })
            });
          });
        });
      },
      eng: function (callback) {
        var tmp_path = req.files[1].path;
        var file_path = "upload/" + time_stamp + '_eng' + ".pdf"
        fs.readFile(tmp_path, function (err, buf) {
          fs.writeFile(file_path, buf, function (err) {
            if (err) {
              callback(err, null)
            }
            fs.unlink(tmp_path, function () { })
            PdfToImage.convertToMultipleImage(file_path, function (imagePaths) {
              req.imagePaths = imagePaths
              req.type = 'eng'
              Corpus.processMultipleImage(req, res, imagePaths, 'eng', output_base_name, function (err, imagePath) {
                req.file_base_name = output_base_name
                callback()
              })
            });
          });
        });
      }
    }, function (err, results) {
      if (err) {
        let apistatus = new APIStatus(StatusCode.ERR_GLOBAL_SYSTEM, 'app').getRspStatus()
        return res.status(apistatus.http.status).json(apistatus);
      }
      Corpus.convertAndCreateCorpus(req, res)
    })

  })
  app.post('/multiple2', upload.array('files', 2), function (req, res) {
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
