var util = require('util');
var net = require("net");
var EventEmitter = require('events').EventEmitter;

var Response = require('./response')
var tmspReader = require('./tmspReader');

//TODO don't forget to implement this.
var maxWriteBufferLength = 4096; // Any more and flush

//Lots TODO especially careful handling of socket 'close' events
//All remaining jobs should be scrapped

function createServer(options){
  return new Server(options)
}

function Server(requestListener){
  if (!(this instanceof Server)) return new Server(requestListener);

    net.Server.call(this, { allowHalfOpen: true });
    this.connected = false;
    this.running = false;
    this.work = false

  if (requestListener) {
    this.addListener('request', requestListener);
  }

  var self = this;

  this.addListener('connection', connectionListener);


}
util.inherits(Server, net.Server);

function connectionListener(socket){
	self = this;

	socket.name = socket.remoteAddress + ":" + socket.remotePort;
	console.log("New Connection at " + socket.name)

	//If already connected reject incoming
	if(this.connected){
		socket.end;
		return;
	}

	var parser = new tmspReader();
	socket.pipe(parser)


	//TODO implement 

	socket.addListener('error', socketOnError);
	socket.addListener('close', serverSocketCloseListener);
/*
	socket.on('end', socketOnEnd);
	socket.on('data', socketOnData);
*/

	function socketOnError(err){
		this.removeListener('error', socketOnError);
		this.destroy(err);
	}

	function serverSocketCloseListener(){
		console.log("Connection closed")
		parser.abort()
	}

	//should handle aborting rest of requests when connection is lost.
	//gracefully
	//need to take into account the edge case of a commit message having been
	//sent to the application but connection closing before it can be written
	//back

	parser.on('readable', onReadable)

	parser.on('empty', onEmpty)

	//This is the request processor loop using events to trigger
	//the next request in the Queue.
	function runNextRequest(){
		var self = this;

		var req = parser.read()
		if (req){
			var res = new Response(req);
			res.assignSocket(socket)

			//No matter how the response object gets closed this
			//will trigger the next one if there is one.
			res.once('close', function(){
				//Check if there is work.
				if(self.work){
					runNextRequest.call(self)
				} else {
					//Let the system know that you have stopped working
					self.working = false;
				}
			});

			this.emit('request', req, res);		
		}
	}

  	function onReadable(){
		self.work = true;
		//If not working get started!
		if(!self.running){
			runNextRequest.call(self);
		}
	}

	function onEmpty(){
		self.work = false
	}

	socket.on('close', function(haderr){console.log("Closing"); console.log(haderr)})  
}

module.exports = {
	Server: Server,
	createServer: createServer
}