// #!/usr/bin/env babel-node

require('./helper')
// let Promise = require("bluebird");
const fs = require('fs')
const express =  require('express')
const PromiseRouter = require('express-promise-router')
const morgan = require('morgan')
const trycatch = require('trycatch')
const bodyParser = require('body-parser')
const R = require('ramda')
const Rx = require('rxjs')
const sleep = require('sleep')
const path = require('path')
const mime = require('mime-types')
const cli = require('./cli')
const EventExpress = require('./event')
const handler = require('./crud')
const archiver = require('archiver')
const nodeify = require('bluebird-nodeify')
const nssocket = require('nssocket')
const chokidar = require('chokidar')
const argv = require('yargs').argv
const https = require('https')
const request = require('request')
Rx.Node = require('rx-node')

const NODE_ENV = process.env.NODE_ENV
const PORT = process.env.PORT || 8000
const ROOT_DIR = process.env.ROOT_DIR || argv.dir || process.cwd()
const SOCKER_PORT = process.env.SOCKER_PORT || 8001
let socket, app = undefined
let clients = {}
async function sendHeaders(req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if(req.stat.isFile()){
      res.writeHead(200, {
        'Content-Length': req.stat.size,
        'Content-Type': mime.contentType(path.extname(req.filePath))
      })
    }
    else{
      req.body = JSON.stringify(await fs.promise.readdir(req.filePath))
      // console.log(req.body)
      res.writeHead(200,{
        // 'Content-Length': req.body.length,
        'Content-Type': 'application/x-gtar'
      })
    }
    return next();
}


async function setFileMeta(req, res, next){
  try{
    req.socket = clients[req.query.token].socket
  }
  catch(e){
    req.socket = { send: (event,data) => undefined }
  }
  req.rootdir = path.resolve(path.join(ROOT_DIR))
  req.filePath = path.resolve(path.join(req.rootdir, 'files', req.url.split('?')[0]))
  if(req.filePath.indexOf(ROOT_DIR) !== 0){
    res.status(400).send('Invalid path')
    return
  }
  if(req.method !== 'PUT'){
    req.stat = await fs.promise.stat(req.filePath).catch( e => {
      res.sendStatus(405)
    })
    return req.stat ? next() : undefined
  }
  return next()
  
}

async function sendPayload(req,res, next){

}




async function main() {
    // Use 'await' in here
    console.log('main()...')
    console.log('Starting server...')
    // debugger
    // Your implementation here
    app = express()
    let router = PromiseRouter()
    // Object.assign(app, router)     // Inherit methods
    app.use(router)
    if(NODE_ENV == 'development'){
      app.use(morgan('dev'))
    }
    // app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())
    app.use(bodyParser.raw())

    app.use((req, res, next) => {
        trycatch(next, e => {
            console.log(e.stack)
            res.writeHead(500)
            res.end(e.stack)
        })
    })


    

    app.head('*', setFileMeta, sendHeaders, (req, res) => res.end())
    app.get('*', setFileMeta, sendHeaders, await handler.process_read)
    app.put('*', setFileMeta, await handler.process_create)
    app.post('*', setFileMeta, await handler.process_update)
    app.delete('*', setFileMeta, await handler.process_delete )
    // debugger
    // Promise.promisifyAll(app.prototype)
    // sleep.sleep(2)
    await app.listen(PORT)
    https.createServer({
      key: fs.readFileSync('./ssl/server_key.pem'),
      cert: fs.readFileSync('./ssl/server_cert.pem')
    }, app).listen(8443)

    let server = nssocket.createServer( st => {
      // if(!socket)
      //   socket = st
      st.data(['connect'], (value) => {
        clients = Object.assign(clients, {
          [value.token]: {
          socket: st,
          name: value.name,
          path: value.path
        }})
      })

      // st.data(['add'], (value) => {
      //   request.put(`http://127.0.0.1:${PORT}` + value.path + `?token=${value.token}`)
      // })
    })
    server.listen(SOCKER_PORT, () => {
      console.log('opened server on', server.address())
    })


    console.log(`Server LISTENING @ http://127.0.0.1:${PORT}`)
    // console.log(`Socket LISTENING @ http://127.0.0.1:${SOCKER_PORT}`)
    // 
    chokidar.watch(`${ROOT_DIR}/files`, {
      interval: 100,
      ignored: /([\/\\]\.|node_modules)/,
      persistent: true,
      ignoreInitial: true,
    })
    .on('all', (event, event_path) => {
      console.log(`Event: ${event} Path: ${event_path}`)
      if(event == 'unlink' || event == 'unlinkDir')
        R.forEach( (token) => {
          clients[token].socket.send(['delete'], event_path.replace(path.join(ROOT_DIR,'files'),''))
        }, Object.keys(clients))
      if(event == 'add' || event == 'change' || event == 'addDir')
        R.forEach( (token) => {
          clients[token].socket.send(['refresh'])
        }, Object.keys(clients))
    })
    // .on('add', path => console.log(`File ${path} has been added`))
    // .on('change', path => console.log(`File ${path} has been changed`))
    // .on('unlink', path => console.log(`File ${path} has been removed`))
    // .on('addDir', path => console.log(`Directory ${path} has been added`))
    // .on('unlinkDir', path => console.log(`Directory ${path} has been removed`))
    // .on('error', error => console.log(`Watcher error: ${error}`))
    // .on('ready', () => console.log('Initial scan complete. Ready for changes'))
    // .on('raw', (event, path, details) => {
    //   console.log('Raw event info:', event, path, details);
    // })
}

main()
