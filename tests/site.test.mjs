import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {validateEnquiry,server} from '../server.mjs';
import path from 'node:path';

const valid={name:'Example Person',email:'person@example.com',company:'Example Company',phone:'',interest:'Software',message:'We would like to discuss a modernization project.',consent:'on',website:'',elapsed:5000};
test('Enquiry accepts valid data and rejects spam, invalid input and missing consent',()=>{
  assert.equal(validateEnquiry(valid),null);
  for(const change of [{email:'not-an-email'},{consent:''},{website:'spam.example'},{elapsed:0},{message:'Short'},{interest:'unrecognized'},{name:' '},{phone:'x'.repeat(41)}])assert.ok(validateEnquiry({...valid,...change}));
  assert.ok(validateEnquiry(null));
});
async function files(dir){const all=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())all.push(...await files(p));else all.push(p);}return all;}
test('Every generated page has unique metadata, one H1, and working local links',async()=>{
  const all=await files('dist');
  const sitemap=await readFile('dist/sitemap.xml','utf8');
  const html=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([,url])=>path.join('dist',new URL(url).pathname,'index.html'));
  html.push(path.join('dist','404.html'));
  assert.equal(html.length,25); // Published pages only; preserve standalone local design previews.
  const titles=new Set();const descriptions=new Set();
  for(const file of html){const text=await readFile(file,'utf8');assert.equal((text.match(/<h1[ >]/g)||[]).length,1,file);const title=text.match(/<title>(.*?)<\/title>/)[1];assert.ok(!titles.has(title),title);titles.add(title);const desc=text.match(/name="description" content="([^"]*)"/)[1];assert.ok(!descriptions.has(desc)||file.includes('terms')||file.includes('privacy'),file);descriptions.add(desc);assert.match(text,/rel="canonical"/);assert.match(text,/application\/ld\+json/);for(const [,href]of text.matchAll(/(?:href|src)="(\/[^"?#]*)/g)){const target=path.join('dist',href.endsWith('/')?href+'index.html':href);assert.ok(all.includes(target),`${file}: missing ${href}`);}}
});
test('HTTP routing, missing pages and non-POST contact requests are handled',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const page=await fetch(base+'/services/');assert.equal(page.status,200);assert.match(page.headers.get('content-type'),/text\/html/);
    assert.equal((await fetch(base+'/missing-page')).status,404);
    assert.equal((await fetch(base+'/.data/enquiries.jsonl')).status,404);
    assert.equal((await fetch(base+'/api/contact')).status,405);
    const invalid=await fetch(base+'/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...valid,consent:''})});assert.equal(invalid.status,400);
    const cross=await fetch(base+'/api/contact',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:JSON.stringify(valid)});assert.equal(cross.status,403);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
