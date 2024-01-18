#!/usr/bin/env node

const lmdb = require('lmdb')
const http = require('http')
const Router = require('./server_helpers').Router
const config_router = require('./router_config').config_router
const dotenv = require('dotenv')
const express = require('express')
const { PurpleInvoiceManager } = require('./invoicing')

function PurpleApi(opts = {}) {
  if (!(this instanceof PurpleApi))
    return new PurpleApi(opts)

  const queue = {}
  const db = lmdb.open({ path: '.' })
  const translations = db.openDB('translations')
  const accounts = db.openDB('accounts')
  const invoices = db.openDB('invoices')
  const dbs = { translations, accounts, invoices }
  const router = express()

  // translation data
  this.translation = { queue }

  this.db = db
  this.dbs = dbs
  this.opts = opts
  this.router = router
  this.invoice_manager = new PurpleInvoiceManager(this, process.env.LN_NODE_ID, process.env.LN_NODE_ADDRESS, process.env.LN_RUNE, process.env.LN_WS_PROXY)
  this.invoice_manager.connect_and_init()

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
