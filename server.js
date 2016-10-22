#!/usr/bin/env babel-node

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
const archiver = require('archiver')
Rx.Node = require('rx-node')

async function Event(callback) {
    return (req,res)  => Rx.Subscriber.create(
      callback({req,res}),
      (err) =>  console.log('Error: ' + err),
      () => console.log('Completed')
    ).next({req,res})
}

async function sendHeaders(req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    let filePath = path.join(__dirname, 'files', req.url)
    let stat = await fs.promise.stat(filePath).catch( e => {
      res.send(405)
    })
    if(stat){
      req.stat = stat
      if(stat.isFile()){
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': mime.contentType(path.extname(filePath))
        })
      }
      
    }
    return next();
}


async function main() {
    // Use 'await' in here
    console.log('main()...')
    console.log('Starting server...')
    // debugger
    // Your implementation here
    let app = express()
    let router = PromiseRouter()
    let port = 8000


    // Object.assign(app, router)     // Inherit methods
    app.use(router)

    app.use(morgan('dev'))
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


    let process_read = new Event(async ({req,res}) => {
      let filePath = path.join(__dirname, 'files', req.url)
      // res.end('test')
      // let data = await fs.promise.readFile(filePath)
      // let pause = Rx.Observable.of(true).delay(1000);
      // let check = await fs.promise.stat(filePath).catch( (e) => {
      //   res.end('file not exists')
      // })
      if(req.stat.isFile()){
        let stream = Rx.Node.fromReadableStream(fs.createReadStream(filePath, { encoding: 'utf8' }))
          .subscribe(
            (v) => {
            // console.log(v)
            // res.writeHead(206, {
            //   "Content-Range": "bytes " + start + "-" + end + "/" + total,
            //   "Accept-Ranges": "bytes",
            //   "Content-Length": chunksize,
            //   "Content-Type": "video/mp4"
            // })
            res.end(v)
            // Rx.Node.fromReadableStream(v)
            // .subscribe(
            //   (v) => console.log(`test 2 ${v}`),
            //   (e) => console.log(e),
            //   () => console.log('completed 2')
            // )
          },
            (e) => res.end(e),
            () => res.end('completed')
          )
      }
      else if(req.stat.isDirectory()){
        res.end(JSON.stringify("ok"))
      }
    })


    let process_create = new Event(async ({req,res}) => {
      // let event = new EventExpress('express', req, res)
      let filePath = path.join(__dirname, 'files', req.url)
      let files = R.filter(t => t != '',path.join('files', req.url).split('/'))
      Rx.Observable.fromPromise(fs.promise.exists(filePath))
      .subscribe(
        async (x) => {
           let message;
           if(files.length == 2){
             let file = files.pop()
             message = await new cli().touchAsync(file)
           }
           else{
             let file = files.pop()
             message = await (await new cli().mkdirAsync(files)).touchAsync(filePath)
           }
           await fs.truncate(filePath, 0)
           req.pipe(fs.createWriteStream(filePath))
           res.send(200)
           res.end('\n')
        } ,
        async (e) => {
          // process.stdout.write(`file ${files.pop()} exists`)
          res.send(405)
          res.end(`file ${files.pop()} exists`)

        },
        async () => {
          // res.end('\n')
        }
      )
      
    })
    let process_update = new Event(async ({req,res}) => {
      let filePath = path.join(__dirname, 'files', req.url)
      Rx.Observable.fromPromise(fs.promise.exists(filePath))
      .subscribe(
        async (x) => {
          res.send(405)
        } ,
        async (e) => {
          await fs.truncate(filePath, 0)
          req.pipe(fs.createWriteStream(filePath))
          res.send(200)
          res.end('\n')
        },
        async () => {
          res.end('\n')
        }
      )
    })

    let process_remove = new Event(async ({req, res}) => {
      let filePath = path.join(__dirname, 'files', req.url)
      // let data = await fs.promise.unlink(filePath)
      await new cli().removeAsync(filePath)
      res.end()
    })

    app.head('*', sendHeaders, (req, res) => res.end())
    app.get('*', sendHeaders, await process_read)
    app.put('*', await process_create)
    app.post('*', await process_update)
    app.delete('*', await process_remove)
    // debugger
    // Promise.promisifyAll(app.prototype)
    // sleep.sleep(2)
    await app.listen(port)
    console.log(`LISTENING @ http://127.0.0.1:${port}`)
}

main()
