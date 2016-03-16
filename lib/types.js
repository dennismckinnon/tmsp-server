//This is something to make the js-tmsp types easier to work with
var types = require('js-tmsp')

var methodLookup = {};

for (var key in types.MessageType){
	if(types.MessageType.hasOwnProperty(key)){
		methodLookup[types.MessageType[key]] = key;
	}
}

var methods = [];

for (var key in types.MessageType){
	if(types.MessageType.hasOwnProperty(key)){
		methods.push(key)
	}
}

var codeLookup = {};
for (var key in types.CodeType){
	if(types.CodeType.hasOwnProperty(key)){
		codeLookup[types.CodeType[key]] = key;
	}
}

module.exports = types;
module.exports.methodLookup = methodLookup;
module.exports.codeLookup = codeLookup;
module.exports.methods = methods;