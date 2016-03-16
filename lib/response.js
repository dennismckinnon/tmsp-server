var util = require('util');
var wire = require("js-wire");
var types = require("./types");
var EventEmitter = require('events').EventEmitter;

var doneListener;
var closeListener;

function Response(req){
	var self = this;

	EventEmitter.call(this);

	//Is there really any reason to attach a socket separate from
	//response creation?
	this.socket = null;
	this.req = req;
	this.finished = false;

	//Response fields
	this.res = {};
	this.res.type = req.type;

	//Response data
	this.type = req.type;
	this.method = req.method;
}
util.inherits(Response, EventEmitter);

function onServerResponseClose(){
	this.close()
}

Response.prototype.assignSocket = function(socket){
	this.socket = socket;
	socket.on('close', onServerResponseClose)
}

Response.prototype.close = function(){
	this.finished = true;
	this.socket.removeListener('close', onServerResponseClose)
	this.emit('close')
}

Response.prototype.destroy = function(error){
	if (this.socket)
		this.socket.destroy(error);
	else
		this.once('socket', function(socket) {
	  		socket.destroy(error);
		});
}

//For writing and then ending the response
Response.prototype.send = function(code, data, log, error){
	var self = this;

	//If response already closed don't allow it to write
	if(this.finished){
		console.log("ALREADY CLOSED1")
		return
	}

	this.write(code, data, log, error)
	this.end()
}

Response.prototype.err = function(err){
	console.log(err)
	//If response already closed don't allow it to write
	if(this.finished){
		console.log("ALREADY CLOSED2")
		return
	}

	var errMsg;
	if (err instanceof Error){
		errMsg = err.message;
	} else {
		errMsg = err;
	}

	this.send({code: types.CodeType.InternalError, error: errMsg})
}

//TODO smarter writing
Response.prototype.write = function(code, data, log, error){
	//If response already closed don't allow it to write
	if(this.finished){
		console.log("ALREADY CLOSED3")
		return
	}

	//Write the response fields
	if (typeof code === 'object'){
		//The information was passed as an object -> unpack it
		data = code.data;
		log = code.log;
		error = code.error;
		code = code.code;
	}

	//Handle missing arguments
	code = (code || types.CodeType.OK)
	data = (data || new Buffer(0))
	log = (log || "")
	error = (error || "")
	

	//Arguments parsing
	if (typeof code === 'number'){
		//The code was passed as a number
		this.res.code = code;
	} else if (typeof code === 'string'){
		//The code was passed as a name -> Try to match the name

		//TODO we should toUppercase() the codes string but we need to change the protobuf
		if(!types.CodeType[code]){
			this.res.code = types.CodeType.OK
		} else {
			this.res.code = types.CodeType[code]
		}
	}

	//TODO? Better stringification
	this.res.data = new Buffer(data)
	this.res.log = log.toString()
	this.res.error = error.toString()
}

function formatResponseBytes(res){
	var msg = new types.Response(res);
	var msgBytes = msg.encode().toBuffer();
	var msgLength = wire.uvarintSize(msgBytes.length);
	var buf = new Buffer(1+msgLength+msgBytes.length);
	var w = new wire.Writer(buf);
	w.writeByteArray(msgBytes); // TODO technically should be writeVarint	
	return w.getBuffer()
}

//Writes to socket and closes this response
Response.prototype.end = function(){
	//If response already closed don't allow it to write
	if(this.finished){
		console.log("ALREADY CLOSED4")
		return
	}

	//I don't think waiting on 'drain' is necessary because these are coming in
	//sequentially and being processed sequentially from a single source
	//so the buffer at the read end should be sufficient.
	//However a buffered writer object might be good regardless
	//TODO think

	console.log("UGGA")
	console.log(this.res)
	resBytes = formatResponseBytes(this.res)
	this.socket.write(resBytes)
	this.close()
}

module.exports = Response;