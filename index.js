#!/usr/bin/env babel-node

require('./helper')
// let Promise = require("bluebird");
const fs = require('fs').promise
const express =  require('express')
const PromiseRouter = require('express-promise-router')
const morgan = require('morgan')
const trycatch = require('trycatch')
const bodyParser = require('body-parser')
const R = require('ramda')
const Rx = require('rxjs')
const sleep = require('sleep')
const path = require('path')

const cli = require('./cli')
// let subscription = Rxreq.subscribe(
//   (x) => console.log('Next: ' + x.toString()),
//   (err) =>  console.log('Error: ' + err  ),
//   () => console.log('Completed')
// )

// async function create(){
//   return (req, res) => Rx.Subscriber.create(
//     async ({req,res}) => {
//       let filePath = path.join(__dirname, 'files', req.url)
//       // let exists = await fs.exists(filePath)
//       // if(!exists){
//         await fs.open(filePath, "wx")
//       // }
//       res.end()
//     },
//     (err) =>  console.log('Error: ' + err  ),
//     () => console.log('Completed')
//   ).next({req,res})
// }

// async function read() {
//     return (req,res)  => Rx.Subscriber.create(
//       async ({req,res}) => {
//         let filePath = path.join(__dirname, 'files', req.url)
//         let data = await fs.readFile(filePath)
//         res.end(data)
//       },
//       (err) =>  console.log('Error: ' + err),
//       () => console.log('Completed')
//     ).next({req,res})
// }




async function CRUD(callback) {
    return (req,res)  => Rx.Subscriber.create(
      callback({req,res}),
      (err) =>  console.log('Error: ' + err),
      () => console.log('Completed')
    ).next({req,res})
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
    let process_read = new CRUD(async ({req,res}) => {
      let filePath = path.join(__dirname, 'files', req.url)
      let data = await fs.readFile(filePath)
      res.end(data)
    })

    let process_create = new CRUD(async ({req,res}) => {
      let filePath = path.join(__dirname, 'files', req.url)
      let files = R.filter(t => t != '',path.join('files', req.url).split('/'))
      Rx.Observable.fromPromise(fs.exists(filePath))
      .subscribe(
        async (x) => {
           // res.writeHead(200, {'Content-Type': 'text/plain'})
           if(files.length == 2){
             res.end(await new cli().touch(files.pop()))
           }
           else{
             let file = files.pop()
             let message = await new cli().mkdir(files).touch(filePath)
             if(req.body){
               await fs.writeFile(filePath, JSON.stringify(req.body))
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

      // var source = exists(filePath)
      // debugger

      // var subscription = source.subscribe(
      //   (x) => console.log('onNext: %s', x) ,
      //   (e) => { console.log('onError: %s', e),
      //   () => console.log('onCompleted')
      // )
      // if(files.length > 1){
      // }
      // let [data, message] = ['','']
      // try{
      //   data = await cli.touch(file)
      //   if(req.body){
      //     await fs.writeFile(filePath, req.body)
      //   }
      //   message = `create ${req.url} success`
      // }
      // catch(e){
        
      // }
      
    })

    let process_update = new CRUD(async ({req,res}) => {
      let filePath = path.join(__dirname, 'files', req.url)
      let data = await fs.writeFile(filePath, req.body)
      res.end()
    })

    let process_remove = new CRUD(async ({req, res}) => {
      let filePath = path.join(__dirname, 'files', req.url)
      // let data = await fs.unlink(filePath)
      // debugger
      console.log(new cli().remove(filePath))
      res.end()
    })
    app.get('*', await process_read)
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
