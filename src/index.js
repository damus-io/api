#!/usr/bin/env node

const lmdb = require('lmdb')
const http = require('http')
const Router = require('./server_helpers').Router
const config_router = require('./router_config').config_router
const dotenv = require('dotenv')
const express = require('express')
const debug = require('debug')('api')
const { PurpleInvoiceManager } = require('./invoicing')

const ENV_VARS = ["LN_NODE_ID", "LN_NODE_ADDRESS", "LN_RUNE", "LN_WS_PROXY", "DEEPL_KEY", "DB_PATH"]

function check_env() {
  const missing = []
  for (const env_var of ENV_VARS) {
    if (process.env[env_var] == null) {
      missing.push(env_var)
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`)
  }
}

function PurpleApi(opts = {}) {
  if (!(this instanceof PurpleApi))
    return new PurpleApi(opts)

  check_env()

  const queue = {}
  const db = lmdb.open({ path: process.env.DB_PATH })
  const translations = db.openDB('translations')
  const accounts = db.openDB('accounts')
  const pubkeys_to_user_ids = db.openDB('pubkeys_to_user_ids')
  const pubkeys_to_user_uuids = db.openDB('pubkeys_to_user_uuids')  // Needed for association with Apple In-App Purchases
  const invoices = db.openDB('invoices')
  const checkout_sessions = db.openDB('checkout_sessions')
  const dbs = { translations, accounts, invoices, pubkeys_to_user_ids, checkout_sessions, pubkeys_to_user_uuids }
  const router = express()

  // translation data
  this.translation = { queue }

  this.db = db
  this.dbs = dbs
  this.opts = opts
  this.router = router
  this.invoice_manager = new PurpleInvoiceManager(this, process.env.LN_NODE_ID, process.env.LN_NODE_ADDRESS, process.env.LN_RUNE, process.env.LN_WS_PROXY)
  debug("loaded invoice-manager node_id:%s node_addr:%s rune:%s proxy:%s", process.env.LN_NODE_ID, process.env.LN_NODE_ADDRESS, process.env.LN_RUNE, process.env.LN_WS_PROXY)
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
