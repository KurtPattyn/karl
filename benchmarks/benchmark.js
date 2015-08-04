var showLocationInformation = false;

var bunyan = require('bunyan');
var bunyanLogger = bunyan.createLogger({name: "myapp", src: showLocationInformation});

var karlLogger = require('../lib/karl');
var util = require('util');

//karlLogger.setOptions({ includeLocationInformation: false, colorize: false, redirectConsole: true, humanReadable: true, json: false });
karlLogger.setOptions({
  includeLocationInformation: showLocationInformation,
  colorize: true,
  redirectConsole: false,
  humanReadable: false,
  json: true
});

var karlLoggerTime = 0;
var bunyanLoggerTime = 0;
var consoleLoggerTime = 0;
var maxTries = 1000;
for (var i = 0; i < maxTries; ++i) {
  var t = process.hrtime();
  karlLogger.info("Created queue %d.", i);
  var diff = process.hrtime(t);
  karlLoggerTime += (diff[0] * 1e9 + diff[1]) / maxTries;
  var t2 = process.hrtime();
  bunyanLogger.info("Created queue %d.", i);
  var diff2 = process.hrtime(t2);
  bunyanLoggerTime += (diff2[0] * 1e9 + diff2[1]) / maxTries;
  var t3 = process.hrtime();
  console.info("Created queue %d.", i);
  var diff3 = process.hrtime(t3);
  consoleLoggerTime += (diff3[0] * 1e9 + diff3[1]) / maxTries;
}
// setImmediate(function() {
  console.log('Console took %s nanoseconds', consoleLoggerTime);
  console.log('Karl took %s nanoseconds', karlLoggerTime);
  console.log('Bunyan took %s nanoseconds', bunyanLoggerTime);
  var diffVsBunyan = bunyanLoggerTime / karlLoggerTime;
  var diffVsConsole = consoleLoggerTime / karlLoggerTime;
  console.log('Speed difference (Karl vs Bunyan): %d times %s.', diffVsBunyan, diffVsBunyan > 1 ? 'faster' : 'slower');
  console.log('Speed difference (Karl vs Console): %d times %s.', diffVsConsole, diffVsConsole > 1 ? 'faster' : 'slower');
// });
