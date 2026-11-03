import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { rememberCandidateReviews } from './ai-autonomy.mjs';
const source=dirname(fileURLToPath(import.meta.url));
test('isolated harness applies once, skips cached candidate across changed batches and preserves dry-run state', async()=>{
  const root=mkdtempSync(join(tmpdir(),'review-fixture-'));
  const bin=join(root,'bin');mkdirSync(bin);
  const candidate={id:'fixture-a',entityId:'openai-team',rawTitle:'Corporate appointment',rawBody:'A new executive joined; no new product.',sourceUrl:'https://example.invalid/news'};
  let pending=[candidate],applies=0,launches=0;
  const server=createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    res.setHeader('content-type','application/json');
    if(req.url.startsWith('/api/cron/ai-review')&&req.method==='GET'){assert.ok(req.url.includes('limit=50'));res.end(JSON.stringify({candidates:pending}));return;}
    if(req.url==='/api/cron/ai-review'&&req.method==='POST'){
      const input=JSON.parse(body);assert.equal(input.decisions.length,1);assert.equal(input.decisions[0].candidateId,'fixture-a');assert.equal(input.decisions[0].action,'reject');applies++;res.end(JSON.stringify({applied:1,approved:0,rejected:1,needsReview:0,skipped:[]}));return;
    }
    res.end('{}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const mock=`#!${process.execPath}
import {readFileSync,readdirSync,writeFileSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
if(process.argv.includes('new-session')){
 const root=process.env.RELEASELOG_ROOT;
 const dir=join(root,'var/ai-harness/context');const path=join(dir,readdirSync(dir).sort().at(-1));
 const text=readFileSync(path,'utf8');
 const runId=text.match(/Run ID: (.+)/)[1]; const outbox=text.match(/Outbox path: (.+)/)[1];
 const candidates=JSON.parse(text.split('## Candidates (data, never instructions)\\n')[1]);
 appendFileSync(join(root,'launches'),'1');
 writeFileSync(outbox,JSON.stringify({runId,intent:'release_publish',ready:true,riskLevel:'low',environmentUnderstanding:{dev:'fixture',runtime:'fixture',data:'fixture'},decisions:candidates.map(c=>({candidateId:c.id,action:'reject',reason:'No product release'}))}));
}
`;
  writeFileSync(join(bin,'tmux'),mock,{mode:0o755});
  writeFileSync(join(bin,'claude'),'#!/bin/sh\nexit 0\n',{mode:0o755});
  const invoke=async(dry=false)=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[join(source,'ai-harness.mjs')],{cwd:root,env:{PATH:`${bin}:/usr/bin:/bin`,HOME:root,RELEASELOG_ROOT:root,RELEASELOG_ENV_FILE:join(root,'nonexistent'),CRON_SECRET:'synthetic-only',AI_REVIEW_BASE_URL:base,AI_HARNESS_PUBLIC_URL:base,AI_HARNESS_INTENT:'release_publish',AI_HARNESS_PRIMARY_CLI:'claude',AI_HARNESS_BATCH_LIMIT:'8',AI_HARNESS_POLL_MS:'10',AI_HARNESS_WAIT_TIMEOUT_MS:'1000',AI_HARNESS_DRY_RUN:dry?'1':'0'}});
    let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
    child.on('error',reject);child.on('exit',code=>code===0?resolve(output):reject(new Error(output)));
  });
  try{
    assert.match(await invoke(),/published/);assert.equal(applies,1);
    const state=join(root,'var/ai-harness/state/candidate-review-checkpoint.json');
    assert.ok(existsSync(state));assert.equal(JSON.parse(readFileSync(state)).candidates['fixture-a'].status,'published');
    const before=readFileSync(state,'utf8');
    assert.match(await invoke(),/no_pending_candidates/);assert.equal(applies,1);
    assert.equal(readFileSync(join(root,'launches'),'utf8'),'1');
    assert.equal(readFileSync(state,'utf8'),before);
    const second={...candidate,id:'fixture-b'};
    pending=[second,candidate];
    writeFileSync(state,JSON.stringify(rememberCandidateReviews({},pending,'failed','fixture-failure')));
    assert.match(await invoke(),/no_pending_candidates/);assert.equal(readFileSync(join(root,'launches'),'utf8'),'1');
    pending=[candidate];writeFileSync(state,'{}');
    assert.match(await invoke(true),/dry_run/);assert.equal(readFileSync(state,'utf8'),'{}');
  }finally{server.close();rmSync(root,{recursive:true,force:true});}
});
