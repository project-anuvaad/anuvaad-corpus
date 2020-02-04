var jaeger = require('./jaeger')
const { Tags, FORMAT_HTTP_HEADERS } = require('opentracing')
const tracer = jaeger("anuvaad");
var LOG = require('../logger/logger').logger


function jaegerCollector(req, res, next) {
    const parentSpanContext = tracer.extract(FORMAT_HTTP_HEADERS, req.headers)
    LOG.debug('rootspan', parentSpanContext)
    if (parentSpanContext) {
        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        var method = req.method;
        var referer = req.headers.referer || "";
        var ua = req.headers['user-agent'];
        let span = tracer.startSpan('node-app', { childOf: parentSpanContext })
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