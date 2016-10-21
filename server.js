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
      console.log(e)
    })
    res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': mime.contentType(path.extname(filePath))
      })
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
    app.use(bodyParser.urlencoded({ extended: false }))
    app.use(bodyParser.json())

    app.use((req, res, next) => {
        trycatch(next, e => {
            console.log(e.stack)
            res.writeHead(500)
            res.end(e.stack)
        })
    })


    let process_read = new Event(async ({req,res}) => {
      let filePath = path.join(__dirname, 'files', req.url)
      // let data = await fs.promise.readFile(filePath)
      let pause = Rx.Observable.of(true).delay(1000);

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
        () => console.log('completed 1')
      )
    })

    let process_create = new Event(async ({req,res}) => {
      let filePath = path.join(__dirname, 'files', req.url)
      let files = R.filter(t => t != '',path.join('files', req.url).split('/'))
      Rx.Observable.fromPromise(fs.promise.exists(filePath))
      .subscribe(
        async (x) => {
           if(files.length == 2){
             let file = files.pop()
             let data = await new cli().touchAsync(file)
             req.pipe(await fs.promise.createWriteStream(filePath, { encoding: 'utf8' }))
             res.end(data)
           }
           else{
             let file = files.pop()
             let message = await (await new cli().mkdirAsync(files)).touchAsync(filePath)
             if(req.body){
               debugger
               req.pipe(await fs.promise.createWriteStream(filePath, { encoding: 'utf8' }))
               // await fs.promise.writeFile(filePath, JSON.stringify(req.body))
             }
             res.end(message.message)
           }
           // return message
        } ,
        async (e) => {
          // process.stdout.write(`file ${files.pop()} exists`)
          res.end(`file ${files.pop()} exists`)
        },
        async () => {
          // process.stdout.write('completed')
          res.end('completed')
        }
      )
    })

    let process_update = new Event(async ({req,res}) => {
      let filePath = path.join(__dirname, 'files', req.url)
      let data = await fs.promise.writeFile(filePath, req.body)
      res.end()
    })

    let process_remove = new Event(async ({req, res}) => {
      let filePath = path.join(__dirname, 'files', req.url)
      // let data = await fs.promise.unlink(filePath)
      // debugger
      console.log(await new cli().removeAsync(filePath))
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
