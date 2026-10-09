#!/usr/bin/env node
import {readFile} from 'node:fs/promises';

const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++){if(!['--alerts','--report'].includes(args[i])||!args[i+1])throw new Error('Invalid option');options[args[i].slice(2)]=args[++i];}
const endpoint=process.env.GRIDPERMIT_ALERT_WEBHOOK_URL;if(!endpoint)throw new Error('GRIDPERMIT_ALERT_WEBHOOK_URL is not configured');
const url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Notification webhook must use HTTPS without embedded credentials');
const alerts=JSON.parse(await readFile(options.alerts,'utf8')),report=await readFile(options.report,'utf8');
const weekly=process.env.GRIDPERMIT_NOTIFICATION_KIND==='weekly';
if(!alerts.alerts?.length&&!weekly)throw new Error('No alert to notify');
const headers={'Content-Type':'application/json'};if(process.env.GRIDPERMIT_ALERT_WEBHOOK_BEARER)headers.Authorization=`Bearer ${process.env.GRIDPERMIT_ALERT_WEBHOOK_BEARER}`;
const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers,body:JSON.stringify({kind:weekly?'weekly':'alert',text:report,alerts:alerts.alerts})});
if(!response.ok)throw new Error(`Notification delivery failed with HTTP ${response.status}`);
console.log(JSON.stringify({delivered:true,alerts:alerts.alerts.length}));
