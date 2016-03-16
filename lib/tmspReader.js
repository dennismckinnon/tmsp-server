var util = require('util');
var types = require("./types");
var LinkedList = require('linkedlist');

var Transform = require('stream').Transform;
util.inherits(tmspReader, Transform);

function tmspReader(options) {
  if (!(this instanceof tmspReader))
    return new Chunker(options);

  Transform.call(this, options);
  this.inBuffer = new Buffer(0);
  this.queue = new LinkedList;
}

readMsg = function(buf) {
  msg = {
    fullLength: 0,
    Length: 0,
    couldRead: false,
    fullBytes: new Buffer(0),
    bytes: new Buffer(0),
    remainder: new Buffer(0)
  }

  //check we can read the first byte
  if(buf.length != 0){
    var msg = {}
    var vLen = buf.readUInt8();

    //Check we can read the next Vlen bytes
    if (buf.length >= vLen +1){
      var v = 0;
      for (var i = 1; i < vLen+1; i++) {
        var next = buf.readUInt8(i);
        v = v * 256 + next;
      }

      //Check we have enough bytes to finish reading
      if (buf.length >= v + vLen + 1){
        msg.fullLength = v+vLen+1;
        msg.Length = v;
        msg.couldRead = true
        msg.fullBytes = buf.slice(0, msg.fullLength)
        msg.bytes = buf.slice(vLen+1, msg.fullLength)
        msg.remainder = buf.slice(msg.fullLength)
      }
    }
  }

  return msg;
}


tmspReader.prototype._transform = function(chunk, encoding, done) {
  this.inBuffer = Buffer.concat([this.inBuffer, chunk]);
  var chunks = [];

  //Pull out as many complete requests as possible
  var nextMsg = readMsg(this.inBuffer)
  while(nextMsg.couldRead){
    this.inBuffer = nextMsg.remainder;
    //We could construct JSON here
    if(nextMsg.couldRead){
      chunks.push(nextMsg.bytes)
    }
    nextMsg = readMsg(this.inBuffer)
  }
  if(chunks){
    this.push(chunks)
  }

  done();
};


tmspReader.prototype.push = function(chunks){
  //Valid Request checking is done in the Request object creation
  //because every request needs a response even if its
  //an error
  if(chunks){
      for (var i = 0; i < chunks.length; i++) {
      var newRequest = new Request(chunks[i])

      //this is implemented so that stream consumers will be happy
      if(this._readableState.flowing){
        this.emit('data', newRequest)
      } else {
        this.queue.push(newRequest)
      }
    };


  }

  //Kind of pointless to call this if everything has already been emptied!
  if(this.queue.length > 0){
    this.emit('readable');
  }

}

//The internal buffer on this has been replaced
//to ensure that discrete requests are processed

tmspReader.prototype.read = function(){
  if(this.queue.length>0){
    next = this.queue.shift();
    if(this.queue.length == 0){
      this.emit('empty')
    }
    return next;
  } else {
    return null
  }
}

tmspReader.prototype.abort = function(){
  //Clear the queue
  //requests don't have a connection to the socket so this make it cleaner
  this.queue = new LinkedList;
  this.emit('empty')
}


module.exports = tmspReader;

//The Request object unlike in http requests is static
//So this stream is built to return it rather then 
//the standard buffer. this means any consumer of this
//stream would need to take account of this fact
function Request(reqBytes){
  var parsed;
  var err

  try {
    parsed = types.Request.decode(reqBytes);
  } catch (e) {
    err = e;
  }


  //Check for request errors here
  if(err){
    this.BadRequest = true;
    this.errCode = types.CodeType.EncodingError;
    this.errMsg = "The request failed to be decoded"
  } else if(!types.methodLookup[parsed.type]){
    //Request type not recognized
    //Make a request object for the error
    this.BadRequest = true;
    this.errCode = types.CodeType.UnknownRequest;
    this.errMsg = "The request type was not understood"
  } else {

    this.BadRequest = false; 
    this.type = parsed.type;
    this.method = types.methodLookup[this.type];
    this.data = parsed.data.buffer.slice(parsed.data.offset);
    this.dataLength = parsed.data.limit - parsed.data.offset;
    this.dataLittle = parsed.data.littleEndian;
    this.key = parsed.key;
    this.value = parsed.value;
  }
}