import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setUpIsolatedSchema, createSqlExecutor } from '../packages/journal/dist/index.js';
import { createLiveRuntime } from '../packages/runtime/dist/index.js';
import { Projector, NoticeBus } from '../packages/projections/dist/index.js';
import { buildApp } from '../packages/api/dist/app.js';
import { hashPassword } from '../packages/api/dist/auth/passwords.js';
import { fileURLToPath } from 'node:url';
const database=process.env.DATABASE_URL??'postgres://postgres:matchledger@localhost:5432/postgres';
const schema=await setUpIsolatedSchema(database,'empty_browser',fileURLToPath(new URL('../packages/journal/migrations/',import.meta.url)));
let runtime,app,browser;
try {
 const sql=createSqlExecutor(schema.pool);
 runtime=await createLiveRuntime({sql,instruments:new Map([['EMPTY',{symbol:'EMPTY',tickSize:1n,lotSize:1n,maxQuantity:10000n,maxPrice:10000n}]]),queueCapacity:10,maxBatch:10,heartbeatMs:5000,onFatal:error=>{throw error;}});
 const password=process.env.E2E_PASSWORD;
 if(!password)throw new Error('Set E2E_PASSWORD for the isolated browser fixture');
 for(const role of ['TRADER','RISK','OPS','ADMIN']){
  await schema.pool.query('INSERT INTO users(user_id,username,password_hash,role) VALUES($1,$1,$2,$3)',[role,await hashPassword(password),role]);
 }
 await schema.pool.query("INSERT INTO user_accounts(user_id,account_id) VALUES('TRADER','empty-account')");
 // Real OpenAccount followed by a zero deposit leaves a zero-funded
 // account. No orders, positions, reconciliation runs or breaks are fabricated.
 await runtime.deposit('empty-account','CASH',0n,'empty-account-bootstrap');
 const projector=new Projector({executor:sql,noticeBus:new NoticeBus()});
 while(await projector.runOnce('risk-0')) { /* actual journal projection */ }
 await runtime.stop();
 // This scratch database models offline matching components for P7's empty state.
 await schema.pool.query('TRUNCATE shard_leases,shard_heartbeats,recovery_log');
 app=await buildApp({config:{NODE_ENV:'development',PORT:3000,METRICS_PORT:3001,DATABASE_URL:database,JWT_SECRET:'empty-browser-fixture-secret-at-least-32',JWT_TTL_SECONDS:900,SESSION_MAX_SECONDS:28800,PROFILE:'prod',PRICE_DECIMALS:2,RATE_LIMIT_ORDERS_PER_SEC:10,RATE_LIMIT_BURST:20,PROJECTOR_POLL_MS:200,PROJECTOR_CHUNK:1000},executor:sql,facade:runtime,instruments:[{symbol:'EMPTY',tick:'1',lot:'1'}],riskConfig:runtime.riskConfig});
 const base=await app.listen({host:'127.0.0.1',port:0});
 browser=await chromium.launch();
 const results=[];
 for(const [role,path,text] of [['TRADER','/trade','No book data'],['TRADER','/portfolio','No positions'],['TRADER','/orders/nonexistent','Order Not Found'],['RISK','/risk','No rejections'],['OPS','/ops/recon','No runs yet'],['ADMIN','/system','No active shards']]){
  const context=await browser.newContext();const page=await context.newPage();
  await page.route('**/api/v1/**',async route=>{const url=new URL(route.request().url());const response=await route.fetch({url:base+url.pathname.replace('/api/v1','')+url.search});await route.fulfill({response});});
  await page.routeWebSocket('**/ws', socket => {
   const upstream=new WebSocket(base.replace('http:','ws:')+'/ws');
   const pending=[];
   socket.onMessage(data=>{if(upstream.readyState===1)upstream.send(data);else{if(pending.length>=8)throw new Error('Unexpected bootstrap socket queue');pending.push(data);}});
   upstream.onopen=()=>{for(const data of pending.splice(0))upstream.send(data);};
   upstream.onmessage=event=>socket.send(event.data);
   socket.onClose(()=>upstream.close());
  });
  await page.goto((process.env.BASE_URL??'http://localhost:5173')+'/login');
  await page.getByPlaceholder('Username').fill(role);await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button',{name:'Login',exact:true}).click();await page.getByRole('button',{name:'Logout',exact:true}).waitFor();
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const delayed=path==='/trade'?'**/api/v1/instruments':path.startsWith('/orders/')?'**/api/v1/orders/**':undefined;
  if(delayed)await page.route(delayed,async route=>{const url=new URL(route.request().url());const response=await route.fetch({url:base+url.pathname.replace('/api/v1','')+url.search});await gate;await route.fulfill({response});});
  await page.goto((process.env.BASE_URL??'http://localhost:5173')+path);
  if(delayed){try{await page.getByText(path==='/trade'?'Loading instruments...':'Loading order...',{exact:true}).waitFor();}finally{release();}}
  if(path==='/trade')await page.getByLabel('Trading symbol').selectOption('EMPTY');await page.getByText(text,{exact:true}).waitFor();
  if(delayed)await page.unroute(delayed);
  if(path==='/portfolio'){await page.getByText('No reservations',{exact:true}).waitFor();assert((await page.locator('body').innerText()).includes('$0.00'));}
  if(path==='/system'){
   assert.equal(await page.getByRole('button',{name:'Kill',exact:true}).count(),0);
   assert.equal(await page.getByRole('button',{name:'Freeze',exact:true}).count(),0);
  }
  if(delayed){await page.route(delayed,route=>route.abort('failed'));await page.goto((process.env.BASE_URL??'http://localhost:5173')+path);if(path==='/trade')await page.getByRole('alert').waitFor();else await page.getByText('Failed to fetch',{exact:true}).waitFor();}
  results.push({path,emptyState:text,loadingAndErrorVerified:!!delayed,realDatabase:true,profile:'prod'});await context.close();
 }
 console.log(JSON.stringify(results));
} finally {await browser?.close();await app?.close();try {await runtime?.stop();} finally {await schema.teardown();}}
