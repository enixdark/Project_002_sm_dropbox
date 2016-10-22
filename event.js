const EventEmitter = require('events')

class Event extends EventEmitter{
  constructor(event_name, req, res){
    super()
    this._event_name = event_name
    this._req = req
    this._res = res
    this._code = 200
    this._message = ''
    this.register(this._event_name)

  }
  register(event_name){
    this.on(event_name, (code, message) => {
      this._res.send(code)
      this._res.end(message)
    })
  }

  emit(event_name, code = 200, message = '\n'){
    this.emit(event_name, code, message)
  }

  set code(Icode){
    this._code = Icode
  }

  get code(){
    return this._code
  }

  set message(Imessage){
    this._message = Imessage
  }

  get message(){
    return this._message
  }
  
  emit(event_name){
    console.log("test " + this._message)
    this._res.send(this._status)
    this._res.end(this._message)
  }
}

module.exports = Event