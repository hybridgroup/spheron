var events = require('events');
var BLEService = "22bb746f2bb075542d6f726568705327";
var WakeCharacteristic = "22bb746f2bbf75542d6f726568705327";
var TXPowerCharacteristic = "22bb746f2bb275542d6f726568705327";
var AntiDosCharacteristic = "22bb746f2bbd75542d6f726568705327";
var RobotControlService = "22bb746f2ba075542d6f726568705327";
var CommandsCharacteristic = "22bb746f2ba175542d6f726568705327";
var ResponseCharacteristic = "22bb746f2ba675542d6f726568705327";

module.exports = function(UUID, responseParser) {
	responseParser = responseParser.spheroResponseParser();

	// thanks to https://github.com/jgautier/firmata/blob/master/lib/firmata.js
	try {
		var ble = require("noble");
	} catch (error) {
		var ble = null;
	}

	if (ble == null) {
		var err = [
			"It looks like you want to connect to a Sphero BB-8 or Sphero Ollie,",
			"but did not install the 'noble' module.", "",
			"To install it run this command:",
			"npm install noble", "",
			"For more information go to https://github.com/sandeepmistry/noble"
		].join("\n");
		console.error(err);
		throw new Error("Missing noble dependency");
	}

	var _connection = new events.EventEmitter();
	var spheroPeripheral;
	var foundedCharacteristics = {};

	_connection.open = function(callback) {
		ble.on("discover", function(peripheral) {
			if (peripheral.id === UUID) {
				spheroPeripheral = peripheral;
				ble.stopScanning();
				connectionRituel(_connection, callback);
			}
		});

		ble.on("stateChange", function(state) {
			if (state === "poweredOn") {
				ble.startScanning();
			} else {
				ble.stopScanning();
			}
		});
	};

	_connection.close = function(callback) {
		spheroPeripheral.disconnect();
		_connection.emit("close");
		if (callback && typeof callback === "function") {
			callback();
		}
	};

	_connection.write = function(buffer, callback) {
		writeCharacteristic(
			RobotControlService,
			CommandsCharacteristic,
			buffer, //new buffer may be needed
			callback
		);
	};

	var connectionRituel = function(_connection, callback) {
		devModeOn(function() {
			getCharacteristic(RobotControlService,ResponseCharacteristic,function(err, c) {
				c.on("read", function(data, isNotify) {
					// Ollie has got a data for us
					responseParser(_connection, data); // Achtung global !!!
				});

				_connection.emit("open");
				if(callback && typeof callback == "function") {
					callback();
				}
			});
		});
	};

	var writeCharacteristic = function(serviceId, characteristicId, value, callback) {
		getCharacteristic(serviceId, characteristicId, function(err, characteristic) {
			if (err) { return callback(err); }

			characteristic.write(new Buffer(value), true, function() {
				if(callback && typeof callback == "function") {
					callback(null);
				}
			});
		});
	};

	var getCharacteristic = function(serviceId, characteristicId, callback) {
		if (foundedCharacteristics[serviceId] && foundedCharacteristics[serviceId][characteristicId]) {
			return callback(null, foundedCharacteristics[serviceId][characteristicId]);
		}

		var p = spheroPeripheral;

		p.connect(function() {
			p.discoverServices([serviceId], function(serErr, services) {
				if (serErr) { return callback(serErr); }

				if (services.length > 0) {
					var s = services[0];
					foundedCharacteristics[serviceId] = {};

					s.discoverCharacteristics(null, function(charErr, characteristics) {
						if (charErr) { return callback(charErr); }

						for (var i in characteristics) {
							if (characteristics[i].uuid === characteristicId) {
								var c = characteristics[i];
								foundedCharacteristics[serviceId][characteristicId] = c;

								callback(null, c);
							}
						};
					});
				} else {
					callback("Service not found", null);
				}
			});
		});
	};

	var devModeOn = function(callback) {
		setAntiDos(function() {
			setTXPower(7, function() {
				wake(function() {
					callback();
				});
			});
		});
	};

	/**
	 * Tells the Ollie/BB-8 to wake up
	 *
	 * @param {Function} callback function to be triggered when the robot is awake
	 * @return {void}
	 * @publish
	 */
	var wake = function(callback) {
		writeCharacteristic(
			BLEService,
			WakeCharacteristic,
			1,
			callback
		);
	};

	/**
	 * Sets the BLE transmit power for the Ollie/BB-8.
	 *
	 * Uses more battery, but gives longer range
	 *
	 * @param {Number} level power to set
	 * @param {Function} callback function to call when done
	 * @return {void}
	 * @publish
	 */
	var setTXPower = function(level, callback) {
		writeCharacteristic(
			BLEService,
			TXPowerCharacteristic,
			level,
			callback
		);
	};

	/**
	 * Sends a special Anti-DoS string to the Ollie/BB-8.
	 *
	 * Used when enabling developer mode
	 *
	 * @param {Function} callback function to call when done
	 * @return {void}
	 */
	var setAntiDos = function(callback) {
		var str = "011i3";
		var bytes = [];

		for (var i = 0; i < str.length; ++i) {
			bytes.push(str.charCodeAt(i));
		}

		writeCharacteristic(
			BLEService,
			AntiDosCharacteristic,
			bytes,
			callback
		);
	};

	return _connection;
}