var events = require('events');

module.exports = function(UUID, responseParser) {
  // thanks to https://github.com/jgautier/firmata/blob/master/lib/firmata.js
  try {
    if (process.browser) {
      var serialPort = require("browser-serialport").SerialPort;
    } else {
      var serialPort = require("serialport").SerialPort;
    }
  } catch (err) {
    var serialPort = null;
  }

  if (serialPort == null) {
    console.log("It looks like serialport didn't compile properly. This is a common problem and its fix is well documented here https://github.com/voodootikigod/node-serialport#to-install");
    throw "Missing serialport dependency";
  }

  var _connection = new events.EventEmitter();

  _connection.open = function(callback) {
    _serialPort = new serialPort(UUID, {
      parser:responseParser.spheroResponseParser()
    }, true, function(err){
      if (err){
        if (callback && typeof callback === "function") {
          callback(err);
        }
      }
    });

    _serialPort.on('open', function() {
      _serialPort.on('data', function(packet) {
        _connection.emit('data', packet);
      });
      _serialPort.on('close', function() {
        _connection.emit('close');
      });
      _serialPort.on('end', function() {
        _connection.emit('end');
      });
      _serialPort.on('error', function(error) {
        _connection.emit('error', error);
      });
      _serialPort.on('oob', function(packet) {
        _connection.emit('oob', packet);
      });

      _connection.emit('open');
      if (callback && typeof callback === "function") {
        callback();
      }
    });
  };
  _connection.close = function(callback) {
    _serialPort.close(callback);
  };
  _connection.write = function(buffer, callback) {

    var cb = function(err, data){
      _connection.emit('write', err, data);
      if (typeof(callback) === 'function'){
        callback(err, data);
      }
    }

    _serialPort.write(buffer, cb);
  };

  return _connection;
}