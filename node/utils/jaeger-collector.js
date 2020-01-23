var jaeger = require('./jaeger')
const tracer = jaeger("anuvaad");
var LOG = require('../logger/logger').logger


function jaegerCollector(req, res, next) {
    LOG.debug('rootspan', req)
    if (req.headers['ad-rootSpan']) {
        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        var method = req.method;
        var referer = req.headers.referer || "";
        var ua = req.headers['user-agent'];
        let span = tracer.startSpan('node-app', { childOf: req.headers['ad-rootSpan'] })
        span.setTag("http.method", method);
        span.setTag("http.referer", referer);
        span.setTag("http.user-agent", ua);
        span.setTag("http.ip", ip);


        res.on('finish', () => {
            var code = res._header ? String(res.statusCode) : String(-1);
            var message = res._header ? String(res.statusMessage) : String(-1);
            span.setTag("http.status_code", code);
            span.setTag("http.status_message", message);
            span.log({ 'event': 'request_end' });
            span.finish();
        });
    }
    next()
}


module.exports = jaegerCollector