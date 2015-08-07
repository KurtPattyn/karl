"use strict";

//disable warnings about unnecessary semicolons
/*jshint -W032 */

/**
 * @module karl
 * The karl logging module for node.js.
 *
 * Copyright (c) 2015 Kurt Pattyn. All rights reserved.
 * @author Kurt Pattyn <pattyn.kurt@gmail.com>
*/

var util = require("util");
var os = require("os");
var path = require("path");
var assert = require("assert");

//helper method; could be in separate module
function extend() {
  var sources = [].slice.call(arguments);
  var firstObject = sources.shift();
  var target = {};

  //first copy the first object into a new one
  for (var prop in firstObject) {
    /* istanbul ignore else */
    if (firstObject.hasOwnProperty(prop)) {
      target[prop] = firstObject[prop];
    }
  }

  //then copy over the properties of the remaining objects
  /* istanbul ignore else */
  if (sources.length > 0) {
    sources.forEach(function (source) {
      for (var prop in source) {
        if (source.hasOwnProperty(prop) && !target.hasOwnProperty(prop)) {
          target[prop] = source[prop];
        }
      }
    });
  }
  return target;
}

//initialize once and keep global to the module
var pid = process.pid;
var applicationName = applicationName || path.basename(process.mainModule.filename, ".js");
var stdout = process.stdout;

/**
 * @constant
*/
var LOG_LEVELS = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

/**
 * @constant
*/
var defaultLogOptions = {
  includeLocationInformation: true,
  colorize: false,
  redirectConsole: true,
  humanReadable: false,
  json: true
};

/**
 * Small helper object to colorize log messages
 * @private
*/
var colors = {
  _colors: util.inspect.colors,

  _colorize: function(msg, color) {
    return "\u001b[" + this._colors[color][0] + "m" +
           msg +
           "\u001b[" + this._colors[color][1] + "m";
  },

  default: function(msg) { return msg; }
};

Object.keys(colors._colors).forEach(function(key) {
  colors[key] = function(msg) { return colors._colorize(msg, key); };
});

/**
 * @constant
*/
var logColors = {
  DEBUG: colors.default,
  INFO: colors.default,
  WARN: colors.yellow,
  ERROR: colors.red,
  FATAL: colors.red
};

var logOptions = defaultLogOptions;

/**
 * Supported formatters:
 * - jsonPrettyPrintFormatter: formats a log message as a JSON string in several lines
 * - jsonFormatter: formats a log message as a one-line JSON string
 * - textFormatter: formats a log message as human-readable line of text
*/
function jsonPrettyPrintFormatter(message) {
  return util.inspect(message);
}

function jsonFormatter(message) {
  return JSON.stringify(message);
}

function textFormatter(message) {
  if (logOptions.includeLocationInformation) {
    return util.format("[%s] %s - %s - %s[%s@%s(%d)]: %s",
                       message.level, message.timestamp, message.hostName, message.process.name,
                       message.functionName, message.fileName, message.lineNumber,
                       message.message);
  } else {
    return util.format("[%s] %s - %s - %s: %s",
                       message.level, message.timestamp, message.hostName,
                       message.process.name, message.message);
  }
}

var formatters = {
  jsonFormatter: jsonFormatter,
  jsonPrettyPrintFormatter: jsonPrettyPrintFormatter,
  textFormatter: textFormatter,

  getFormatter: function(options) {
    return !options.humanReadable ? formatters.jsonFormatter :
                                    (options.json ? formatters.jsonPrettyPrintFormatter :
                                                    formatters.textFormatter);
  }
};

/**
 * @constant
*/
var defaultFormatter = formatters.getFormatter(defaultLogOptions);

/**
 * The currently active formatter.
*/
var currentFormatter = null;

var karl = {
  version: require("../package.json").version
};

var dummyTrace = {
  getFileName: function() { return null; },
  getLineNumber: function() { return null; },
  getFunctionName: function() { return null; }
};

/**
 * Get stack info of caller.
 * @returns a CallSite object
 * @see https://code.google.com/p/v8-wiki/wiki/JavaScriptStackTraceApi
 */
function getStackInfo(limFn) {
  /* jshint unused: false */
  assert(util.isFunction(limFn));

  var stackInfo;
  var obj = {};
  var saveLimit = Error.stackTraceLimit;
  var savePrepare = Error.prepareStackTrace;

  Error.stackTraceLimit = 1;
  Error.captureStackTrace(obj, limFn);

  Error.prepareStackTrace = function(_, stack) {
    stackInfo = stack[0];
  };

  //assign obj.stack to a dummy variable to avoid JSHint warning:
  //'Expected an assignment or function call and instead saw an expression.'
  //Combined with the jshint unused flag at the start of the method, this wil suppress any JSHint warnings
  var dummy = obj.stack;

  Error.stackTraceLimit = saveLimit;
  Error.prepareStackTrace = savePrepare;

  return stackInfo;
}

var stackTrace = {
  get: getStackInfo
};

LOG_LEVELS.forEach(function(level) {
  karl[level.toLowerCase()] = function _log() {
    // var t = process.hrtime();
    var trace = logOptions.includeLocationInformation ? stackTrace.get(_log) : dummyTrace;
    var timestamp = new Date();

    // var diff = process.hrtime(t);
    // console.log('Logging took %d nanoseconds', diff[0] * 1e9 + diff[1]);
    var format = currentFormatter || defaultFormatter;
    var parameters = arguments;

    setImmediate(function() {
      //var caller = trace[0];
      var caller = trace;
      var fn = caller.getFileName();

      var message = {
        timestamp: timestamp.toISOString(),
        level: level,
        hostName: os.hostname(),
        process: {
          name: applicationName,
          pid: pid
        },
        message: util.format.apply(util, parameters),
        fileName: fn ? path.basename(fn) : fn,
        lineNumber: caller.getLineNumber(),
        functionName: caller.getFunctionName() || "<anonymous>"
      };
      var msg = format(message) + "\n";

      if (logOptions.colorize) {
        msg = logColors[level](msg);
      }

      stdout.write(msg);
    });
  };
});

var defaultConsole = {};

["log", "info", "warn", "error"].forEach(function(level) {
    defaultConsole[level] = console[level];
  });

function redirectConsole(enable) {
  if (enable) {
    //check if console.log was not already redirected
    /* istanbul ignore else */
    if (console.log === defaultConsole.log) {
      //redirect console.log, .info, .warn and .error logging methods to our logger
      console.log = karl.info.bind(karl);

      ["info", "warn", "error"].forEach(function(level) {
        console[level] = karl[level].bind(karl);
      });
    }
  } else {
    //check if console.log has been redirected
    /* istanbul ignore else */
    if (console.log !== defaultConsole.log) {
      //reset to default
      ["log", "info", "warn", "error"].forEach(function(level) {
          console[level] = defaultConsole[level];
        });
    }
  }
}

/* istanbul ignore else */
if (defaultLogOptions.redirectConsole) {
  redirectConsole(defaultLogOptions.redirectConsole);
}

// karl.setFormatter = function setFormatter(formattingFunction) {
//   assert.ok(!formattingFunction || util.isFunction(formattingFunction));
//   currentFormatter = formattingFunction;
// };
karl.setOptions = function setOptions(options) {
  logOptions = extend(options, defaultLogOptions);
  redirectConsole(logOptions.redirectConsole);
  currentFormatter = formatters.getFormatter(logOptions);
};

process.on("uncaughtException", /* istanbul ignore next */ function(err) {
  karl.fatal("UncaughtException: ", err.stack);
  setImmediate(function() {
    process.kill(process.pid, "SIGINT");
  });
});

module.exports = karl;
