# karl
  [![NPM Version][npm-image]][npm-url]
  [![NPM Downloads][downloads-image]][downloads-url]
  
##### Author: [Kurt Pattyn](https://github.com/kurtpattyn).
  
Karl is a lightning fast[1] asynchronous logging library with both structured and text based output.
It follows [the twelve-factor app methodology](http://12factor.net) by only logging to the console.
Karl has no external dependencies (except for its tests).

*\[1]: Benchmarking (benchmarks/benchmark.js) revealed that Karl was around 10 times faster than Bunyan (both with location information disabled; otherwise all defaults enabled), and that it was around 5 times faster with location information enabled.*  
*Karl is also about 5 times faster than directly logging to the console with location information disabled, and about 50% faster with location information enabled.*  
*All tests were conducted on node v0.12.0 running on a MacBook Pro 17" Retina with a Quad-core Core i7 processor with OS X Yosemite.*

## Motivation
Karl wants to be a better `console` logger by also providing source information (filename, functionname and linenumber) and timestamps and by providing structured logging (JSON format) besides text based logging.  
Structured logging is ideal when it needs to be consumed by external logging services like Loggly.  
By default Karl redirects the `console` output to go through its own logger. The net result is `console` output decorated with source information and optional coloring.

Karl is different from other popular logging modules like Bunyan and Winston in that it does not provide routing and filtering of log messages: all messages go always to stdout, from debug() to fatal() messages.
We believe that routing and filtering should be done by a log management tool like [Logstash](https://www.elastic.co/products/logstash), [Logplex](https://github.com/heroku/logplex), [Fluentd](https://github.com/fluent/fluentd), and so on and not by the application itself.  
This is certainly the case when we think [microservices](http://microservices.io) and Docker based applications. See also: [The Twelve-Factor App](http://12factor.net/logs).

## Installation

```bashp
$ npm install karl
```

or

```bashp
$ npm install karl --production
```
for a production only installation (no tests, documentation, ...).

## Usage
``` js
  var karl = require('karl');

  karl.debug('Everything looks fine.');
  karl.info('Need some more info huh?');
  karl.warn('Didn\'t you forget something?');
  karl.error('This definitely went bezerk.');
  karl.fatal('This is the end, my friend!');
```

Output:

```sh
{"timestamp":"2015-08-02T18:02:39.456Z","level":"DEBUG","hostName":"<hidden>","process":{"name":"karltest","pid":26693},"message":"Everything looks fine.","fileName":"karltest.js","lineNumber":41,"functionName":"<anonymous>"}
{"timestamp":"2015-08-02T18:02:39.456Z","level":"INFO","hostName":"<hidden>","process":{"name":"karltest","pid":26693},"message":"Need some more info huh?","fileName":"karltest.js","lineNumber":42,"functionName":"<anonymous>"}
{"timestamp":"2015-08-02T18:02:39.456Z","level":"WARN","hostName":"<hidden>","process":{"name":"karltest","pid":26693},"message":"Didn't you forget something?","fileName":"karltest.js","lineNumber":43,"functionName":"<anonymous>"}
{"timestamp":"2015-08-02T18:02:39.456Z","level":"ERROR","hostName":"<hidden>","process":{"name":"karltest","pid":26693},"message":"This definitely went bezerk.","fileName":"karltest.js","lineNumber":44,"functionName":"<anonymous>"}
{"timestamp":"2015-08-02T18:02:39.456Z","level":"FATAL","hostName":"<hidden>","process":{"name":"karltest","pid":26693},"message":"This is the end, my friend!","fileName":"karltest.js","lineNumber":45,"functionName":"<anonymous>"}
```

All log messages are formatted using [util.format()](https://nodejs.org/api/util.html#util_util_format_format).
Hence the following works also:

```javascript
  var someObject = {
    a: 1,
    b: {
      c: "Owkay"
    }
  };
  karl.info("someObject", someObject);
  karl.info("You have %d options.", 3);
```

Output:

```sh
{"timestamp":"2015-08-02T17:56:32.186Z","level":"INFO","hostName":"<hidden>","process":{"name":"karltest","pid":26603},"message":"someObject { a: 1, b: { c: 'Owkay' } }","fileName":"karltest.js","lineNumber":48,"functionName":"<anonymous>"}
{"timestamp":"2015-08-02T17:58:41.671Z","level":"INFO","hostName":"<hidden>","process":{"name":"karltest","pid":26632},"message":"You have 3 options.","fileName":"karltest.js","lineNumber":48,"functionName":"<anonymous>"}
```

## Customise Formatting
The output above is not easy to read for humans.
Karl provides the option `humanReadable` to make the output easier to digest for human beings.

```javasript
karl.setOptions({ humanReadable: true });
karl.info('I like reading log files.');
```

Output:

```sh
{ timestamp: '2015-08-02T18:09:50.334Z',
  level: 'INFO',
  hostName: '<hidden>',
  process: { name: 'karltest', pid: 26792 },
  message: 'I like reading log files.',
  fileName: 'karltest.js',
  lineNumber: 43,
  functionName: '<anonymous>' }
```

This output is already better digestable by a human.

Karl can be instructed to output in plain text as well, by setting the `json` option to `false`.

```javascript
karl.setOptions({
  humanReadable: true,
  json: false
});
karl.info('I like reading log files in plain English.');
```

Output:

```sh
[INFO] <hostname-hidden> 2015-08-02T18:17:16.738Z - karltest[<anonymous>@karltest.js(43)]: I like reading log files in plain English.
```

To make the log output even more human digestable, the output can be colored by setting the `colorize` option to `true`. The `colorize` options will output *error* and *fatal* messages in red, *warning* messages in yellow and all other messages in the current text color of the terminal.

```javascript
karl.setOptions({
  humanReadable: true,
  json: false,
  colorize: true
});
karl.error('I like reading log files in red.');
karl.warning('I like reading log files in yellow.');
```
Output cannot be shown in color as GitHub markdown does not support colored text.

## Customize Information
By default, Karl logs a `timestamp`, the `log level`, the `hostname`, the `location` from where the log method was called along with the message itself.
Fetching location information is an expensive operation, making the logging around 4 times slower (20 microseconds vs 5 microseconds per call on my MacBook). Karl provides the 'includeLocationInformation' option to turn location information on or off.

```javascript
karl.setOptions({ includeLocationInformation: false }); //turns location information off
karl.setOptions({ includeLocationInformation: true });  //turns location information on (default)
```

Location information is included by default and must be disabled explicitly.

## Console Redirection
By default Karl redirects all `console` output to its own logger.
As a consequence, all console messages are decorated with location information and a timestamp.

`console.info('Hi there!)` is exactly the same as `karl.info('Hi there!)`.
The `console.log()` method is redirected to `karl.info()`.

To disable this redirection, set the `redirectConsole` option to `false`.

```javascript
karl.setOptions({ redirectConsole: false });
```

## UncaughtException
Karl catches any uncaught exception (see [Event 'uncaughtException'](https://nodejs.org/api/process.html#process_event_uncaughtexception)).
When such an exception occurs, Karl logs a fatal log message (including stack trace) and then gracefully shuts down the process by emitting a `SIGINT` signal.


## License

  [MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/dm/localeval.svg
[npm-url]: https://www.npmjs.com/package/karl
[downloads-image]: https://img.shields.io/npm/dm/express.svg
[downloads-url]: https://npmjs.org/package/karl