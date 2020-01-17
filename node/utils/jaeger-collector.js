var jaeger = require('./jaeger')
const tracer = jaeger("anuvaad-node");


function jaegerCollector(req, res, next) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var method = req.method;
    var url = req.url;
    var referer = req.headers.referer || "";
    var ua = req.headers['user-agent'];
    let span = tracer.startSpan(url)
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
    next()
}


module.exports = jaegerCollector