require('./helper')
const fs = require('fs')
const express =  require('express')
const PromiseRouter = require('express-promise-router')
const morgan = require('morgan')
const trycatch = require('trycatch')
const bodyParser = require('body-parser')
const R = require('ramda')
const Rx = require('rxjs')
const path = require('path')
const nssocket = require('nssocket')
const request = require('request')
const argv = require('yargs').argv
const tar = require('tar')
const concat = require('concat-stream')
const faker = require('faker')
const chokidar = require('chokidar')
const token = require('rand-token').generate(16)
const url = require('url')
const cli = require('./cli')

Rx.Node = require('rx-node')

const NODE_ENV = process.env.NODE_ENV
const PORT = process.env.PORT || 8000
const SOCKER_PORT = process.env.SOCKER_PORT || 8001
const ROOT_DIR = process.env.ROOT_DIR || argv.dir || process.cwd() 
const SERVER_URI = process.env.SERVER_URI || 'http://127.0.0.1:8000'

let cache_file = {}
function request_to_server(event_path, name, token,  type, body, callback){
  let sync = undefined
  try{
    sync = url.parse(event_path).query.sync
  }
  catch(e){}
  if(!sync){
    if(type == 'dir')
      callback(SERVER_URI + event_path.replace(`${ROOT_DIR}/source/${name}`,'').split('?')[0] + `/?token=${token}`)
    else
      if(request.post == callback){
        callback({
          url: SERVER_URI + event_path.replace(`${ROOT_DIR}/source/${name}`,'').split('?')[0] + `?token=${token}`,
          body: body
        })
      }
      else{
        callback(SERVER_URI + event_path.replace(`${ROOT_DIR}/source/${name}`,'').split('?')[0] + `?token=${token}`)
      }
  }
  

}

async function main(){
  let name = faker.internet.email()
  // let name = 'test'
  console.log(`client ${name} connect to socket ${SOCKER_PORT}`)
  let options = {
      url: SERVER_URI,
      headers: {'Accept': 'application/x-gtar'}
  }
  try{
    fs.mkdirSync(`${ROOT_DIR}/source/${name}`)
  }catch(e){

  }
  let extract = tar.Extract({path: `${ROOT_DIR}/source/${name}`})
    // .on('error', (err) => console.error('An error occurred:', err) )
    // .on('end', () => console.log('Extracted successfully') )
  request(options, SERVER_URI ).pipe(extract)
  
  let client = new nssocket.NsSocket()
  client.connect(SOCKER_PORT)
  client.on('close', () => {
    console.log('close')
  })
  client.data(["event"], (payload) => {
    let json = JSON.parse(payload)
    console.log(`${json.type} ${json.action} at: ${json.path}`)
  })
  client.data(['refresh'], () => {
    request(options, SERVER_URI + '?sync=false').pipe(tar.Extract({path: `${ROOT_DIR}/source/${name}`}))
  })
  client.data(['delete'], async (event_path) => {
    console.log(`${ROOT_DIR}/source/${name}`)
    await new cli().removeAsync(event_path, `${ROOT_DIR}/source/${name}`).catch( e => {})
  })
  chokidar.watch(`${ROOT_DIR}/source/${name}`, {
    interval: 100,
    ignored: /([\/\\]\.|node_modules)/,
    persistent: true,
    ignoreInitial: true,
  })
  .on('add', event_path => {
    // request.put(SERVER_URI + event_path.replace(`${ROOT_DIR}/source/${name}`,'') + `?token=${token}`)
    request_to_server(event_path, name, token, 'file', '', request.put)
  })
  .on('change', event_path => {
    // request.post(SERVER_URI + event_path.replace(`${ROOT_DIR}/source/${name}`,'') + `?token=${token}` )
    let body = fs.readFileSync(event_path, "utf-8")
    if(body !== cache_file[event_path]){
      cache_file[event_path] = body
      request_to_server(event_path, name, token, 'file', body, request.post)
    }
  })
  .on('unlink', event_path => {
    // request.delete(SERVER_URI + event_path.replace(`${ROOT_DIR}/source/${name}}`,'') + `?token=${token}`)
    request_to_server(event_path, name, token, 'file', '', request.delete)
  })
  .on('addDir', event_path => {
    // request.put(SERVER_URI + event_path.replace(`${ROOT_DIR}/source/${name}`,'') + `/?token=${token}` )
    request_to_server(event_path, name, token, 'dir', '', request.put)
  })
  .on('unlinkDir', event_path => {
    // request.delete(SERVER_URI + event_path.replace(`${ROOT_DIR}/source/${name}`,'') + `/?token=${token}`)
    request_to_server(event_path, name, token, 'dir', '', request.delete)
  })
  .on('error', err => {})
  // .on('all', (event, path) => {
  //   console.log(`Event: ${event} Path: ${path}`)
  // })

  client.send("connect", {
      token: token,
      name: name,
      path:`${ROOT_DIR}/source/${name}`
    }
  )



}

main()