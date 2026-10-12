import {createGameAdvice} from './native-ai/routes.mjs';
import http from 'node:http';
import { query, literal } from './db.mjs';
import { issueToken, verifyPassword, verifyToken } from './auth.mjs';
const host=process.env.HOST||'127.0.0.1', port=Number(process.env.BACKEND_PORT);
const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));};
async function input(req){let raw='';for await(const chunk of req)raw+=chunk;return raw?JSON.parse(raw):{};}
const auth=(req)=>{let user;try{user=verifyToken(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));}catch{return null;}if(!user||!Number.isSafeInteger(Number(user.sub))||Number(user.sub)<1)return null;return query(`SELECT id FROM runtime_users WHERE id=${Number(user.sub)}`).length?user:null;};
const gameAdvice=createGameAdvice({query,literal,auth,json});
const server=http.createServer(async(req,res)=>{try{
  if(await gameAdvice(req,res))return;
  if(req.method==='GET'&&req.url==='/api/health'){query('SELECT 1');return json(res,200,{status:'ready'});}
  if(req.method==='GET'&&req.url==='/api/auth/demo-credentials'){if(process.env.NODE_ENV==='production')return json(res,404,{error:'Not found'});const email=process.env.PROVISION_ADMIN_EMAIL||process.env.ADMIN_EMAIL||'',password=process.env.PROVISION_ADMIN_PASSWORD||process.env.ADMIN_PASSWORD||'';return email&&password?json(res,200,{email,password}):json(res,503,{error:'Demo credentials unavailable'});}
  if(req.method==='POST'&&req.url==='/api/auth/login'){const body=await input(req),email=String(body.email||'').trim().toLowerCase();const rows=query(`SELECT id,email,password_hash,name,role FROM runtime_users WHERE email=${literal(email)} LIMIT 1`);if(!rows[0]||!verifyPassword(String(body.password||''),rows[0][2]))return json(res,401,{error:'Invalid credentials'});const user={id:rows[0][0],email:rows[0][1],name:rows[0][3],role:rows[0][4]};return json(res,200,{token:issueToken(user),user});}
  if(req.method==='GET'&&req.url==='/api/auth/me'){const user=auth(req);if(!user)return json(res,401,{error:'Authentication required'});const rows=query(`SELECT id,email,name,role FROM runtime_users WHERE id=${Number(user.sub)}`);return rows[0]?json(res,200,{id:rows[0][0],email:rows[0][1],name:rows[0][2],role:rows[0][3]}):json(res,401,{error:'Account unavailable'});}
  return json(res,404,{error:'Not found'});
}catch(error){return json(res,500,{error:error.message});}});
server.listen(port,host,()=>console.log(`Tetris runtime API listening on http://${host}:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
