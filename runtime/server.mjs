import {createGameAdvice} from './native-ai/routes.mjs';
import http from 'node:http';
import { query, literal } from './db.mjs';
import { issueToken, verifyPassword, verifyToken } from './auth.mjs';
import { createTaskStore, validateTaskInput, filterRecords, toCsv, runWaveAi } from './wave3d.mjs';
const waveTasks=createTaskStore();
const host=process.env.HOST||'127.0.0.1', port=Number(process.env.BACKEND_PORT);
const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));};
async function input(req){let raw='';for await(const chunk of req)raw+=chunk;return raw?JSON.parse(raw):{};}
const auth=(req)=>{let user;try{user=verifyToken(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));}catch{return null;}if(!user||!Number.isSafeInteger(Number(user.sub))||Number(user.sub)<1)return null;return query(`SELECT id FROM runtime_users WHERE id=${Number(user.sub)}`).length?user:null;};
const gameAdvice=createGameAdvice({query,literal,auth,json});
const server=http.createServer(async(req,res)=>{try{
  if(await gameAdvice(req,res))return;
  if(req.method==='GET'&&req.url==='/api/health'){query('SELECT 1');return json(res,200,{status:'ok'});}
  if(req.method==='POST'&&req.url==='/api/auth/login'){const body=await input(req),email=String(body.email||'').trim().toLowerCase();const rows=query(`SELECT id,email,password_hash,name,role FROM runtime_users WHERE email=${literal(email)} LIMIT 1`);if(!rows[0]||!verifyPassword(String(body.password||''),rows[0][2]))return json(res,401,{error:'Invalid credentials'});const user={id:rows[0][0],email:rows[0][1],name:rows[0][3],role:rows[0][4]};return json(res,200,{token:issueToken(user),user});}
  if(req.method==='GET'&&req.url==='/api/auth/me'){const user=auth(req);if(!user)return json(res,401,{error:'Authentication required'});const rows=query(`SELECT id,email,name,role FROM runtime_users WHERE id=${Number(user.sub)}`);return rows[0]?json(res,200,{id:rows[0][0],email:rows[0][1],name:rows[0][2],role:rows[0][3]}):json(res,401,{error:'Account unavailable'});}
  const waveUrl=new URL(req.url,'http://localhost');
  if(waveUrl.pathname==='/api/tasks'&&['GET','POST'].includes(req.method)){const user=auth(req);if(!user)return json(res,401,{error:'Authentication required'});if(req.method==='GET')return json(res,200,{tasks:waveTasks.list(user.sub,{q:waveUrl.searchParams.get('q')||'',status:waveUrl.searchParams.get('status')||''})});const body=await input(req);const {errors,value}=validateTaskInput(body);if(errors.length)return json(res,400,{error:errors.join('; ')});return json(res,201,waveTasks.create(user.sub,value));}
  const waveTask=waveUrl.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if(waveTask&&req.method==='PATCH'){const user=auth(req);if(!user)return json(res,401,{error:'Authentication required'});const body=await input(req);const {errors,value}=validateTaskInput(body,{partial:true});if(errors.length)return json(res,400,{error:errors.join('; ')});const task=waveTasks.update(user.sub,decodeURIComponent(waveTask[1]),value);return task?json(res,200,task):json(res,404,{error:'Task not found'});}
  if(waveUrl.pathname==='/api/records'&&req.method==='GET'){const user=auth(req);if(!user)return json(res,401,{error:'Authentication required'});const rows=query(`SELECT id,feature,model,created_at FROM runtime_ai_results WHERE user_id=${Number(user.sub)} ORDER BY created_at DESC LIMIT 200`).map(r=>({id:r[0],feature:r[1],status:r[1],model:r[2],createdAt:r[3]}));return json(res,200,{records:filterRecords(rows,{q:waveUrl.searchParams.get('q')||'',status:waveUrl.searchParams.get('status')||''})});}
  if(waveUrl.pathname==='/api/export/records'&&req.method==='GET'){const user=auth(req);if(!user)return json(res,401,{error:'Authentication required'});const rows=query(`SELECT id,feature,model,created_at FROM runtime_ai_results WHERE user_id=${Number(user.sub)} ORDER BY created_at DESC LIMIT 200`).map(r=>({id:r[0],feature:r[1],status:r[1],model:r[2],createdAt:r[3]}));const records=filterRecords(rows,{q:waveUrl.searchParams.get('q')||'',status:waveUrl.searchParams.get('status')||''});if((waveUrl.searchParams.get('format')||'').toLowerCase()==='json')return json(res,200,{resource:'records',exportedAt:new Date().toISOString(),count:records.length,records});res.writeHead(200,{'content-type':'text/csv'});return res.end(toCsv(records));}
  const waveAi=waveUrl.pathname.match(/^\/api\/ai-features\/([^/]+)$/);
  if(waveAi&&req.method==='POST'){const user=auth(req);if(!user)return json(res,401,{error:'Authentication required'});const body=await input(req);const result=await runWaveAi(decodeURIComponent(waveAi[1]),body.stats||body);if(!result)return json(res,404,{error:'Unknown AI feature'});return json(res,200,result);}
  return json(res,404,{error:'Not found'});
}catch(error){return json(res,500,{error:error.message});}});
server.listen(port,host,()=>console.log(`Tetris runtime API listening on http://${host}:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
