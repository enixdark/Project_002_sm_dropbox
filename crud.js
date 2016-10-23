require('./helper')
const fs = require('fs')
const R = require('ramda')
const Rx = require('rxjs')
const path = require('path')
const mime = require('mime-types')
const cli = require('./cli')
const archiver = require('archiver')
Rx.Node = require('rx-node')


async function Event(callback) {
    return (req,res)  => Rx.Subscriber.create(
      callback({req,res}),
      (err) =>  console.log('Error: ' + err),
      () => console.log('Completed')
    ).next({req,res})
}

function payload(action, path, type, updated = Date.parse(new Date()) ){
  return JSON.stringify({
              "action": action,
              "path": path,
              "type": type,
              "updated":updated
        })
}


let process_read = new Event(async ({req,res}) => {
  if(req.stat.isFile()){
    let stream = Rx.Node.fromReadableStream(fs.createReadStream(req.filePath, { encoding: 'utf8' }))
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
            req.socket.send(['event'], payload('read', req.path, 'file'))
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
    if(req.headers['accept'] == 'application/x-gtar'){
      // let output = fs.createWriteStream(__dirname + '/example-output.tar');
      let archive = archiver('tar')
      archive.pipe(res)
      // archive.pipe(output)
      archive.bulk([
        { expand: true, cwd: req.filePath, src: ['**']}
      ])
      archive.finalize()
    }
    else{
      req.socket.send('event', payload('read', req.path, 'dir'))
      res.end(req.body)
    }
  }
})


let process_create = new Event(async ({req,res}) => {
      // let event = new EventExpress('express', req, res)
      let files = R.filter(t => t != '',path.join('files', req.url).split('/'))

      Rx.Observable.fromPromise(fs.promise.exists(req.filePath))
      .subscribe(
        async (x) => {
         let message;
         if(files.length == 2){
           let file = files.pop()
           message = await new cli().touchAsync(req.filePath).catch( e => {})
           req.socket.send('event', payload('write', req.path, 'file'))
         }
         else{
           let file = files.pop()
           message = await (await new cli().mkdirAsync(files)).touchAsync(req.filePath).catch( e => {})
           R.reduce( async (root, next)  => {
              let new_path = path.join(await root,next)
              fs.promise.stat(new_path).catch( e => {
                req.socket.send('event', payload('write', new_path, 'dir'))
              })
              return new_path
           }, req.rootdir, files)
           req.socket.send('event', payload('write', req.filePath, 'file'))
         }
         await fs.truncate(req.filePath, 0)
         req.pipe(fs.createWriteStream(req.filePath))
         res.sendStatus(200)
         res.end('\n')
       } ,
       async (e) => {
          // process.stdout.write(`file ${files.pop()} exists`)
          res.sendStatus(405)
          res.end(`file ${files.pop()} exists`)

        },
        async () => {
          // res.end('\n')
        }
        )
    })

let process_update = new Event(async ({req,res}) => {
  Rx.Observable.fromPromise(fs.promise.exists(req.filePath))
  .subscribe(
    async (x) => {
      res.sendStatus(405)
    } ,
    async (e) => {
      await fs.truncate(req.filePath, 0)
      req.pipe(fs.createWriteStream(req.filePath))
      req.socket.send('event', payload('write', req.filePath, 'file'))
      res.sendStatus(200)
      res.end('\n')
    },
    async () => {
      res.end('\n')
    }
    )
})

let process_delete = new Event(async ({req, res}) => {
      // let data = await fs.promise.unlink(req.filePath)
      await new cli().removeAsync(req.filePath).catch(e => {})
      if(req.stat.isFile()){
        req.socket.send('event', payload('delete', req.filePath, 'file'))
      }
      else if(req.stat.isDirectory()){
        req.socket.send('event', payload('delete', req.filePath, 'dir'))
      }
      res.end()
    })

module.exports = {
  process_read,
  process_delete,
  process_update,
  process_create
}