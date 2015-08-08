var karl = require('..');
//karl.setOptions({ redirectConsole: false });
var assert = require('assert');
var util = require('util');

var stdout = process.stdout;
var oldWriteFunc = stdout.write;

describe('karl', function() {
  var stack = [];

  beforeEach(function() {
      stack = [];
      // hook into stdout to see what's being sent to it
      process.stdout.write = (function(write) {
        return function(buf, encoding, fd) {
          //write.call(stdout, buf, encoding, fd);
          stack.push(buf); // our extra
        };
       }(oldWriteFunc));
  });

  afterEach(function() {
    process.stdout.write = oldWriteFunc;
    karl.setOptions({ redirectConsole: false });
  });

  describe('.info()', function () {
    it('should send a message to stdout', function (done) {
      karl.info('test');
      setImmediate(function() {
        assert.equal(stack.length, 1);
        assert(util.isString(stack[0]));
        var msg = JSON.parse(stack[0]);
        assert(msg["message"]);
        assert.equal(msg["message"], 'test');
        done();
      });
    });
  });

  describe('.debug()', function() {
    it('should send a message to stdout', function (done) {
      karl.debug('test');
      setImmediate(function() {
        assert.equal(stack.length, 1);
        assert(util.isString(stack[0]));
        var msg = JSON.parse(stack[0]);
        assert(msg["message"]);
        assert.equal(msg["message"], 'test');
        done();
      });
    });
  });

  describe('.options.colorize', function() {
    it('should output in color', function(done) {
      karl.setOptions({ colorize: true, redirectConsole: false });
      karl.warn('Should be in yellow.');
      setImmediate(function() {
        assert.equal(stack.length, 1);
        assert(util.isString(stack[0]));
        assert.equal(stack[0].indexOf('\u001b[' + util.inspect.colors.yellow[0]), 0);
        var sentinel = '\u001b[' + util.inspect.colors.yellow[1];
        assert.equal(stack[0].indexOf(sentinel), stack[0].length - sentinel.length - 1);
        done();
      });
    });

    it('should not output in color', function(done) {
      karl.setOptions({ colorize: true, redirectConsole: false });
      karl.info('Should be in yellow.');
      setImmediate(function() {
        assert.equal(stack.length, 1);
        assert(util.isString(stack[0]));
        assert.equal(stack[0].indexOf('\u001b['), -1);
        done();
      });
    });
  });

  describe('.options.includeLocationInformation', function() {
    it('should not contain valid location information', function(done) {
      karl.setOptions({ redirectConsole: false, includeLocationInformation: false });
      karl.warn('Should have no location information.');
      setImmediate(function() {
        assert.equal(stack.length, 1);
        assert(util.isString(stack[0]));
        var msg = JSON.parse(stack[0]);
        assert(util.isObject(msg));
        assert(msg.hasOwnProperty("fileName"));
        assert(msg.hasOwnProperty("lineNumber"));
        assert(msg.hasOwnProperty("functionName"));
        assert(!msg.fileName);
        assert(!msg.lineNumber);
        assert.equal(msg.functionName, "<anonymous>");
        done();
      });
    });
  });

  describe('.options.json=true', function() {
    it('should output json on a single line', function(done) {
      karl.setOptions({ redirectConsole: false, json: true });
      karl.info('This should be a single-line JSON message');
      setImmediate(function() {
        assert.equal(stack.length, 1);
        assert(util.isString(stack[0]));
        var lines = stack[0].split('\n');
        assert.equal(lines.length, 2);
        done();
      });
    });

    it('should print a single line with location information', function(done) {
      karl.setOptions({ redirectConsole: false, humanReadable: true, json: false });
      karl.warn('Plain ol\'text.');
      setImmediate(function() {
        assert.equal(stack.length, 1);
        assert(util.isString(stack[0]));
        assert.notEqual(stack[0].indexOf("[WARN]"), -1);
        assert.notEqual(stack[0].indexOf("test.js"), -1);
        done();
      });
    });

    it('should print a single line without location information', function(done) {
      karl.setOptions({ redirectConsole: false, humanReadable: true, json: false, includeLocationInformation: false });
      karl.warn('Plain ol\'text.');
      setImmediate(function() {
        assert.equal(stack.length, 1);
        assert(util.isString(stack[0]));
        assert.notEqual(stack[0].indexOf("[WARN]"), -1);
        assert.equal(stack[0].indexOf("test.js"), -1);
        done();
      });
    });
  });
});
