#!/usr/bin/env babel-node

require('./helper')
let fs = require('fs')
let R = require('ramda')
let path = require('path')
let Rx = require('rxjs')

class Cli {
  constructor(message = ''){
    this._message = message
  }

  mkdir(files) {
    R.reduce((root, folder) => {
        let new_path = path.join(root,folder)
        try{
          fs.mkdirSync(new_path)
        }
        catch(e){
          process.stdout.write(`mkdir: cannot create directory ${new_path}: File exists \n`)
        }
        return new_path
    },__dirname,files)
    return this
  }

  touch(file) {
    try{
      fs.open(file, 'wx')
    }
    catch(e){
      // throw new Error(`file ${file} exists`)
      this._message = `file ${file} exists`
    }
    return this
  }

  remove(file_path, dir = __dirname){
    let folders = this.removeDir(file_path)
    R.forEach(
      d => fs.rmdir(d),
      R.flatten(folders.reverse())
    )
    return this
  }

  removeDir(file_path, dir = __dirname){
    try{
      let check = fs.statSync(file_path)
      if(check.isFile() ){
        fs.unlink(file_path)
        return []
      }
      let lists = []
      if(check.isDirectory() ){
        // let files = R.filter( t => t != '',file_path.replace(__dirname,'').split('/'))
        let filenames = fs.readdirSync(file_path)
        if(filenames.length > 0){
          lists.push(file_path)
          R.forEach( file => {
            // console.log(path.join(rootPath,file))
            lists.push(this.removeDir(path.join(file_path,file),dir))
          }, filenames)
        }
        else{
          return [file_path]
        }
      }
      return lists;
    }
    catch(e){
      console.log(`no such file or directory, stat ${file_path}`)
      return []
    }
  }

  isExistFile(file){
    return fs.existsSync(file)
  }

  get message(){
    return this._message
  }

  set message(newMessage){
    this._message = newMessage
  }
}

// async function mkdir(files) {
//     R.reduce(async (root, folder) => {
//         let new_path = path.join(await root,folder)
//         try{
//           await fs.mkdir(new_path)
//         }
//         catch(e){
//           process.stdout.write(`mkdir: cannot create directory ${new_path}: File exists \n`)
//         }
//         return new_path
//     },__dirname,files)
// }

// async function touch(file) {
//     try{
//       return await fs.open(file, 'wx')
//     }
//     catch(e){
//       // throw new Error(`file ${file} exists`)
//       return `file ${file} exists`
//     }

// }

module.exports = Cli
// {
//   mkdir,
//   touch
// }

