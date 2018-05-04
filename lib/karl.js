/**
 * @file The karl logging module for node.js.
 *
 * @copyright 2015 Kurt Pattyn. All rights reserved.
 * @author Kurt Pattyn <pattyn.kurt@gmail.com>
 *
 * @public
*/

"use strict";

//disable warnings about unnecessary semicolons
/*jshint -W032 */

const util = require("util");
const os = require("os");
const path = require("path");
const assert = require("assert");

/**
 * Mixes the enumerable properties of the source objects to the target object.
 * The properties of the target object are not overwritten.
 * The target object is not changed; instead a new object is created.
 * This method is handy to mix in default options with user supplied options.
 * Note: extend() does not do a deepCopy of the properties, only 'flat' objects are supported
 *
 * @param {Object} targetObject The target object of the mixins. The target object is not overwritten
 * @param {...Object} sourceObjects One or more source objects to mix into the target object.
 *
 * @example
 * extend ({ a: 1 }, { a: 2, b: 3}, { c: 4 })
 * --> { a: 1, b: 3, c: 4 }
 *
 * @private
*/
function extend(targetObject, sourceObjects) {
  const sources = [].slice.call(arguments);
  const firstObject = sources.shift();
  let target = {};

  for (let prop in firstObject) {
    /* istanbul ignore else */
    if (firstObject.hasOwnProperty(prop)) {
      target[prop] = firstObject[prop];
    }
  }

  //then copy over the properties of the remaining objects
  /* istanbul ignore else */
  if (sources.length > 0) {
    sources.forEach(function (source) {
      for (let prop in source) {
        if (source.hasOwnProperty(prop) && !target.hasOwnProperty(prop)) {
          target[prop] = source[prop];
        }
      }
    });
  }
  return target;
}

//initialize once and keep global to the module
/** @private */
const pid = process.pid;
/** @private */
const applicationName = path.basename(process.mainModule.filename, ".js");
/** @private */
const stdout = process.stdout;

/**
 * @constant
 * @private
*/
const LOG_LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

/**
 * @constant
 * @private
*/
const defaultLogOptions = {
  includeLocationInformation: true,
  colorize: false,
  redirectConsole: true,
  json: true
};

/**
 * Small helper object to colorize log messages
 * @private
*/
const colors = {
  _colors: util.inspect.colors,

  _colorize: function(msg, color) {
    return "\u001b[" + this._colors[color][0] + "m" +
           msg +
           "\u001b[" + this._colors[color][1] + "m";
  },

  defaultTextColor: function(msg) { return msg; }
};

/** @private */
Object.keys(colors._colors).forEach(function(key) {
  colors[key] = function(msg) { return colors._colorize(msg, key); };
});

/**
 * @constant
 * @private
*/
const logColors = {
  TRACE: colors.green,
  DEBUG: colors.defaultTextColor,
  INFO: colors.defaultTextColor,
  WARN: colors.yellow,
  ERROR: colors.red,
  FATAL: colors.red
};

/** @private */
let logOptions = defaultLogOptions;

/**
 * Supported formatters:
 * - jsonFormatter: formats a log message as a one-line JSON string
 * - textFormatter: formats a log message as human-readable line of text
 *
 * @private
*/
/** @private */
function jsonFormatter(message) {
  return JSON.stringify(message);
}

/** @private */
function textFormatter(message) {
  if (logOptions.includeLocationInformation) {
    return util.format("[%s] %s - %s - %s[%s@%s/%s(%d)]: %s",
                       message.level, message.timestamp, message.hostName, message.process.name,
                       message.functionName, message.filePath, message.fileName, message.lineNumber,
                       message.message);
  } else {
    return util.format("[%s] %s - %s - %s: %s",
                       message.level, message.timestamp, message.hostName,
                       message.process.name, message.message);
  }
}

/** @private */
const formatters = {
  jsonFormatter: jsonFormatter,
  textFormatter: textFormatter,

  getFormatter: function(options) {
    return options.json ? formatters.jsonFormatter : formatters.textFormatter;
  }
};

/**
 * @constant
 *
 * @private
*/
const defaultFormatter = formatters.getFormatter(defaultLogOptions);

/**
 * The currently active formatter.
 *
 * @private
*/
let currentFormatter = null;

/**
 * The karl logger.
 *
 * @example
 * var karl = require(karl);
 * karl.info('Hello');
 *
 * @property {String} version The version of the karl module.
*/
let karl = {
  version: require("../package.json").version
};

module.exports = karl;

/**
 * @constant
 *
 * @private
*/
const dummyTrace = {
  getFileName: function() { return null; },
  getLineNumber: function() { return null; },
  getFunctionName: function() { return null; }
};

/**
 * @class CallSite
 * A CallSite object defines the following methods:
 * getThis returns the value of this
 * getTypeName: returns the type of this as a string. This is the name of the function stored in the constructor field of this, if available, otherwise the object's [[Class]] internal property.
 * getFunction: returns the current function
 * getFunctionName: returns the name of the current function, typically its name property. If a name property is not available an attempt will be made to try to infer a name from the function's context.
 * getMethodName: returns the name of the property of this or one of its prototypes that holds the current function
 * getFileName: if this function was defined in a script returns the name of the script
 * getLineNumber: if this function was defined in a script returns the current line number
 * getColumnNumber: if this function was defined in a script returns the current column number
 * getEvalOrigin: if this function was created using a call to eval returns a CallSite object representing the location where eval was called
 * isToplevel: is this a toplevel invocation, that is, is this the global object?
 * isEval: does this call take place in code defined by a call to eval?
 * isNative: is this call in native V8 code?
 * isConstructor: is this a constructor call?
 *
 * @see https://code.google.com/p/v8-wiki/wiki/JavaScriptStackTraceApi
 */

/**
 * Get stack info of caller.
 * @returns {CallSite} a CallSite object
 *
 * @private
 */
function getStackInfo(limFn) {
  /* jshint unused: false */
  assert(util.isFunction(limFn));

  let stackInfo = null;
  let obj = {};
  const saveLimit = Error.stackTraceLimit;
  const savePrepare = Error.prepareStackTrace;

  Error.stackTraceLimit = 1;
  /**
   * @external Error.captureStackTrace
   */
  Error.captureStackTrace(obj, limFn);

  Error.prepareStackTrace = function(_, stack) {
    stackInfo = stack[0];
  };

  //assign obj.stack to a dummy variable to avoid JSHint warning:
  //'Expected an assignment or function call and instead saw an expression.'
  //Combined with the jshint unused flag at the start of the method, this wil suppress any JSHint warnings
  const dummy = obj.stack;

  Error.stackTraceLimit = saveLimit;
  Error.prepareStackTrace = savePrepare;

  return stackInfo;
}

/** @private */
const stackTrace = {
  get: getStackInfo
};

/**
 * @function debug
 * @description Logs the given arguments with level debug.
 *
 * @instance
 *
 * @param {String} message The message to log.
 * @param {...*} [extra] Optional information to log; can be anything that is printable
 *
 * @example
 * var karl = require("karl");
 *
 * karl.debug("Hello!");
 * var someObject = { a: 1, b: 2 };
 * karl.debug("someObject is now: ", someObject);
 *
 * @public
*/
/**
 * @function info
 * @description Logs the given arguments with level info.
 * @instance
 *
 * @param {String} message The message to log.
 * @param {...*} [extra] Optional information to log; can be anything that is printable
 *
 * @example
 * var karl = require("karl");
 *
 * karl.info("Hello!");
 * var someObject = { a: 1, b: 2 };
 * karl.info("someObject is now: ", someObject);
 *
 * @public
*/
/**
 * @function warn
 * @description Logs the given arguments with level warn.
 * @instance
 *
 * @param {String} message The message to log.
 * @param {...*} [extra] Optional information to log; can be anything that is printable
 *
 * @example
 * var karl = require("karl");
 *
 * karl.warn("Hello!");
 * var someObject = { a: 1, b: 2 };
 * karl.warn("someObject is now: ", someObject);
 *
 * @public
*/
/**
 * @function error
 * @description Logs the given arguments with level error.
 * @instance
 *
 * @param {String} message The message to log.
 * @param {...*} [extra] Optional information to log; can be anything that is printable
 *
 * @example
 * var karl = require("karl");
 *
 * karl.error("Hello!");
 * var someObject = { a: 1, b: 2 };
 * karl.error("someObject is now: ", someObject);
 *
 * @public
*/
/**
 * @function fatal
 * @description Logs the given arguments with level fatal.
 * @instance
 *
 * @param {String} message The message to log.
 * @param {...*} [extra] Optional information to log; can be anything that is printable
 *
 * @example
 * var karl = require("karl");
 *
 * karl.fatal("Hello!");
 * var someObject = { a: 1, b: 2 };
 * karl.fatal("someObject is now: ", someObject);
 *
 * @public
*/
LOG_LEVELS.forEach(function(level) {
  karl[level.toLowerCase()] = function _log() {
    const trace = logOptions.includeLocationInformation ? stackTrace.get(_log) : dummyTrace;
    const timestamp = new Date();

    const format = currentFormatter || defaultFormatter;
    const parameters = arguments;

    setImmediate(function() {
      const caller = trace;
      const fn = caller.getFileName();

      const message = {
        timestamp: timestamp.toISOString(),
        level: level,
        hostName: os.hostname(),
        process: {
          name: applicationName,
          pid: pid
        },
        message: util.format.apply(util, parameters),
        fileName: fn ? path.basename(fn) : fn,
        filePath: fn ? path.relative(process.cwd(), path.dirname(fn)) : fn,
        lineNumber: caller.getLineNumber(),
        functionName: caller.getFunctionName() || "<anonymous>"
      };

      if (logOptions.enrich) {
        logOptions.enrich(message);
      }
      let msg = format(message) + "\n";

      if (logOptions.colorize) {
        msg = logColors[level](msg);
      }

      stdout.write(msg);
    });
  };
});

/** @private */
let defaultConsole = {
  debug: console.log
};

/** @private */
["trace", "log", "info", "warn", "error"].forEach(function(level) {
    defaultConsole[level] = console[level];
  });

/** @private */
function redirectConsole(enable) {
  if (enable) {
    //check if console.log was not already redirected
    /* istanbul ignore else */
    if (console.log === defaultConsole.log) {
      //redirect console.log, .info, .warn and .error logging methods to our logger
      console.log = karl.info.bind(karl);

      ["trace", "debug", "info", "warn", "error"].forEach(function(level) {
        console[level] = karl[level].bind(karl);
      });
    }
  } else {
    //check if console.log has been redirected
    /* istanbul ignore else */
    if (console.log !== defaultConsole.log) {
      //reset to default
      ["trace", "debug", "log", "info", "warn", "error"].forEach(function(level) {
          console[level] = defaultConsole[level];
        });
    }
  }
}

/** @private */
/* istanbul ignore else */
if (defaultLogOptions.redirectConsole) {
  redirectConsole(defaultLogOptions.redirectConsole);
}

/**
 * Changes the way karl behaves.
 *
 * @param {Object} [options] The logging options to set.
 * @param {Boolean} [options.includeLocationInformation=true] Instructs karl to include the file name, function name and linenumber into the log message.
 * @param {Boolean} [options.colorize=false] When true, karl outputs error and fatal messages in red, warning errors in yellow and other messages in the current text color.
 * @param {Boolean} [options.redirectConsole=true] When true, console messages are redirected through karl (optionally including location information and adding color).
 * @param {Boolean} [options.json=true] When true, messages are printed as json messages, otherwise plain text is printed.
 * @param {Function} [options.enrich] An optional callback method that can be used to add additional information to a log message. The enrich method takes a message JSON struct as parameter. The enrich method should directly change the message object and does not have to return anything.
 *
 * @public
*/
module.exports.setOptions = function setOptions(options) {
  logOptions = extend(options, defaultLogOptions);
  redirectConsole(logOptions.redirectConsole);
  currentFormatter = formatters.getFormatter(logOptions);
};

/** @private */
process.on("uncaughtException", /* istanbul ignore next */ function(err) {
  karl.fatal("UncaughtException: ", err.stack);
  setImmediate(function() {
    process.kill(process.pid, "SIGINT");
  });
});
