/* jshint node:true */

var events = require('events'),
	responseParser = require('./response-parser'),
	commands = require('./commands');

/**
 *  Creates a new Sphero object
 *
 * @returns {events.EventEmitter}
 */
module.exports = function(device) {

	var _sphero = new events.EventEmitter();
	
	var _connection = require("./connection")(device, responseParser)
	
	var options = {
		resetTimeout:false,
		requestAcknowledgment:false
	};

	_sphero.resetTimeout = function(reset) {
		if (typeof(reset) === 'undefined') {
			return options.resetTimeout;
		} else {
			options.resetTimeout = reset;
			return _sphero;
		}
	};

	_sphero.requestAcknowledgement = function(acknowledge) {
		if (typeof(acknowledge) === 'undefined') {
			return options.requestAcknowledgment;
		} else {
			options.requestAcknowledgment = acknowledge;
			return _sphero;
		}
	};

	_sphero.open = function(callback) {
		_connection.open(callback);

		_connection.on('open', function() {
			_connection.on('data', function(packet) {
				_sphero.emit('packet', packet);
				switch (packet.SOP2) {
					case 0xFF:
						_sphero.emit('message', packet);
						break;
					case 0xFE:
						_sphero.emit('notification', packet);
						break;
				}
			});

			_connection.on('close', function() {
				_sphero.emit('close');
			});

			_connection.on('end', function() {
				_sphero.emit('end');
			});

			_connection.on('error', function(error) {
				_sphero.emit('error', error);
			});

			_connection.on('oob', function(packet) {
				_sphero.emit('oob', packet);
			});

			_sphero.emit('open');
		});
	}

	_sphero.close = function(callback) {
		_connection.close(callback);
		return _sphero;
	}

	_sphero.write = function(buffer, callback) {
		_connection.write(buffer, callback);
		return _sphero;
	}

	cascadeCommands(_sphero);

	return _sphero;
};

var cascadeCommands = function(sphero) {

	var func;
	var interceptor = function(sphero, func) {
		return function() {
			var options;
			var args = Array.prototype.slice.call(arguments);
			var callback = null;

			if (typeof(args[args.length - 1]) === 'function'){
				callback = args[args.length - 1]
			}

			if (args.length === func.length) {
				//An options parameter has been supplied, we just need to make changes where necessary
				options = args[args.length-1];
				if (!options.hasOwnProperty('resetTimeout')) {
					options.resetTimeout = sphero.resetTimeout();
				}
				if (!options.hasOwnProperty('requestAcknowledgement')) {
					options.requestAcknowledgement = sphero.requestAcknowledgement();
				}
			} else {
				//No options parameter has been supplied, we should build the
				args.push({
					resetTimeout:sphero.resetTimeout(),
					requestAcknowledgement:sphero.requestAcknowledgement()
				});
			}

			var packet = func.apply(this, args);

			sphero.write(packet, callback);

			return sphero;
		};
	};

	for (func in commands.core) {
		if (commands.core.hasOwnProperty(func) && typeof(commands.core[func])==='function') {
			sphero[func] = interceptor(sphero, commands.core[func]);
		}
	}

	for (func in commands.api) {
		if (commands.api.hasOwnProperty(func) && typeof(commands.api[func])==='function') {
			sphero[func] = interceptor(sphero, commands.api[func]);
		}
	}


};
