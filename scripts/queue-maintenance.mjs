#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { loadEnvFile } from './ai-session-send.mjs';
import { planQueue, applyRejections } from './queue-policy.mjs';
const root = process.env.RELEASELOG_ROOT || resolve(fileURLToPath(new URL('..', import.meta.url)));
const apply = process.argv.includes('--apply'), dir = join(root, 'var/queue-maintenance');
const fixture = process.argv.find(x => x.startsWith('--snapshot='))?.slice(11);
if (apply && fixture) throw new Error('fixture_cannot_apply');
const atomic = (path, data) => { const temp=path+'.tmp'; writeFileSync(temp, JSON.stringify(data,null,2)+'\n',{mode:0o600}); renameSync(temp,path); };
function sqlSnapshot() {
  const sql = `set statement_timeout='15s'; begin isolation level repeatable read read only;
select json_build_object('capturedAt',now(),'pending',(select coalesce(json_agg(c),'[]'::json) from (select * from release_candidates where status='pending' order by created_at desc,id)c),'published',(select coalesce(json_agg(p),'[]'::json) from (select id,entity_id,title,date,source_url,published_at from published_releases order by id)p));commit;`;
  const r = spawnSync('docker',['exec','-i','releaselog-db-1','sh','-c','exec psql -X -qAt -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],{input:sql,encoding:'utf8',timeout:30000,maxBuffer:64*1024*1024});
  if (r.status !== 0) throw new Error('queue_snapshot_failed'); return JSON.parse(r.stdout);
}
function activeReview() {
  const path=join(root,'var/ai-harness/state/active-run.json');
  if (existsSync(path)) { const a=JSON.parse(readFileSync(path)); if (!existsSync(a.outboxPath) && Date.parse(a.deadlineAt)>Date.now()) return true; }
  // The dependency runs before the review service starts; a running harness wins.
  const s=spawnSync('systemctl',['show','releaselog-ai-review.service','-p','MainPID','--value'],{encoding:'utf8',timeout:5000});
  if (s.status!==0) throw new Error('review_state_unavailable'); return Number(s.stdout.trim())>0;
}
if (apply && activeReview()) { console.log(JSON.stringify({ok:true,status:'review_busy',noMutations:true})); process.exit(0); }
const snapshot=fixture ? JSON.parse(readFileSync(fixture,'utf8')) : sqlSnapshot();
const seeds=[]; const entities=join(root,'data/entities');
if (existsSync(entities)) for (const file of readdirSync(entities).filter(f=>f.endsWith('.json'))) { const entity=JSON.parse(readFileSync(join(entities,file))); for(const r of entity.releases || []) seeds.push({...r,entityId:entity.id}); }
const plan=planQueue(snapshot.pending,[...seeds,...snapshot.published]);
const counts=Object.fromEntries([...new Set(plan.rejected.map(d=>d.rule))].map(rule=>[rule,plan.rejected.filter(d=>d.rule===rule).length]));
const summary={ok:true,status:apply?'applying':'dry_run',policy:plan.policy,before:snapshot.pending.length,reject:plan.rejected.length,keep:plan.kept.length,counts};
if (!apply) { console.log(JSON.stringify({...summary,kept:plan.kept.map(c=>({id:c.id,title:c.raw_title,date:c.raw_published_at,entity:c.entity_id}))})); process.exit(0); }
mkdirSync(dir,{recursive:true,mode:0o700});const runId=randomUUID(), backup=plan.rejected.length ? join(dir,runId+'-before.json') : null;
if (backup) { atomic(backup,snapshot); atomic(join(dir,runId+'-plan.json'),plan); }
loadEnvFile(process.env.RELEASELOG_ENV_FILE || join(root,'.env.docker'));
if (!process.env.CRON_SECRET) throw new Error('cron_secret_missing');
const base=new URL(process.env.AI_REVIEW_BASE_URL || 'http://127.0.0.1:3000');
if(base.protocol!=='http:' || !['127.0.0.1','localhost','[::1]'].includes(base.hostname)) throw new Error('maintenance_api_must_be_loopback');
const receipts=await applyRejections(plan.rejected,async body=>{
  const response=await fetch(new URL('/api/cron/ai-review',base),{method:'POST',headers:{authorization:`Bearer ${process.env.CRON_SECRET}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error('rejection_api_http_'+response.status);return response.json();
},receipts=>atomic(join(dir,runId+'-receipts.json'),receipts));
const after=sqlSnapshot(), byId=new Map(after.published.map(p=>[p.id,p]));
if(!snapshot.published.every(p=>JSON.stringify(byId.get(p.id))===JSON.stringify(p))) throw new Error('published_records_changed_during_sweep');
const afterPending=new Set(after.pending.map(c=>c.id));if(plan.rejected.some(d=>afterPending.has(d.candidateId)))throw new Error('rejected_candidates_still_pending');
const recentPublished=after.published.filter(p=>Date.parse(p.published_at)>=Date.now()-30*86400000).map(p=>({id:p.id,entityId:p.entity_id,title:p.title,date:p.date,sourceUrl:p.source_url}));
const result={...summary,status:'completed',runId,finishedAt:new Date().toISOString(),remaining:after.pending.length,publishedUnchanged:true,backup,backupSHA256:backup ? createHash('sha256').update(readFileSync(backup)).digest('hex') : null,receipts,recentPublished};
if (backup) atomic(join(dir,runId+'-result.json'),result);
atomic(join(dir,'last-sweep.json'),result);
console.log(JSON.stringify({...summary,status:'completed',runId,remaining:after.pending.length,publishedUnchanged:true}));
