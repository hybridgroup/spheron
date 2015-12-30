function isSerialPort(str) {
  // use regexp to determine whether or not 'str' is a serial port
  return /(\/dev\/|com\d+).*/i.test(str);
}

module.exports = function(stri, responseParser) {
	if (isSerialPort(stri)) {
		return require("./serialPort")(stri, responseParser)
	} else if (typeof chrome !== "undefined") {
		// chrome ble
	} else {
		return require("./ble")(stri, responseParser)
	}
}