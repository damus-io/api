#!/usr/bin/env node

const lmdb = require('lmdb')
const http = require('http')
const Router = require('./server_helpers').Router
const config_router = require('./router_config').config_router
const dotenv = require('dotenv')
const express = require('express')

function PurpleApi(opts = {}) {
  if (!(this instanceof PurpleApi))
    return new PurpleApi(opts)

  const queue = {}
  const db = lmdb.open({ path: '.' })
  const translations = db.openDB('translations')
  const accounts = db.openDB('accounts')
  const dbs = { translations, accounts }
  const router = express()

  // translation data
  this.translation = { queue }

  this.db = db
  this.dbs = dbs
  this.opts = opts
  this.router = router

  return this
}

PurpleApi.prototype.serve = async function pt_serve(port) {
  const theport = this.opts.port || port || 8989
  this.router.listen(theport)
  console.log(`Server listening on ${theport}`)
}

PurpleApi.prototype.close = async function pt_close() {
  // close lmdb
  await this.db.close()
}

PurpleApi.prototype.register_routes = function pt_register_routes() {
  config_router(this)
}

module.exports = PurpleApi

if (require.main == module) {
  // Load .env file if it exists
  dotenv.config()

  let translate = new PurpleApi()
  translate.register_routes()
  translate.serve(process.env.PORT)
}
