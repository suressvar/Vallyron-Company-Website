import http from 'node:http';
import {readFile,stat,mkdir,appendFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {services,products} from './src/content.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'dist');
const port=Number(process.env.PORT||4173);
const dataDir=path.resolve(process.env.CONTACT_DATA_DIR||'.data');
const allowedInterests=new Set([...services.map(s=>s.title),...products.map(p=>p.name),'Support','Careers','General enquiry']);
const recent=new Map();
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.xml':'application/xml','.txt':'text/plain; charset=utf-8','.png':'image/png'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
export function validateEnquiry(data){
  if(!data||typeof data!=='object'||Array.isArray(data))return 'Please provide a valid enquiry.';
  if(data.website)return 'Your enquiry could not be verified. Please try again.';
  if(typeof data.elapsed!=='number'||!Number.isFinite(data.elapsed)||data.elapsed<2000)return 'Please take a moment to review your enquiry before submitting.';
  for(const [key,max,min] of [['name',120,2],['email',254,3],['company',160,2],['message',5000,20]]){
    if(typeof data[key]!=='string'||data[key].trim().length<min||data[key].length>max)return `Please enter a valid ${key}${key==='message'?' (20–5,000 characters)':''}.`;
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))return 'Please enter a valid email address.';
  if(typeof data.phone!=='undefined'&&(typeof data.phone!=='string'||data.phone.length>40))return 'Please enter a valid phone number.';
  if(!allowedInterests.has(data.interest))return 'Please select an area of interest.';
  if(data.consent!=='on')return 'Your consent is required to submit an enquiry.';
  return null;
}
export const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/contact'){
      if(req.method!=='POST'){json(res,405,{message:'Use the contact form to submit your enquiry.'});return;}
      if(!req.headers['content-type']?.startsWith('application/json')){json(res,415,{message:'Please submit the enquiry using the contact form.'});return;}
      const expectedOrigin=process.env.SITE_URL||`http://${req.headers.host}`;
      if(req.headers.origin&&req.headers.origin!==expectedOrigin){json(res,403,{message:'This request could not be verified.'});return;}
      const address=req.socket.remoteAddress;const now=Date.now();
      for(const [key,value]of recent){if(now-value.start>600000)recent.delete(key);}
      const rate=recent.get(address)||{start:now,count:0};
      if(rate.count>=5){res.setHeader('Retry-After','600');json(res,429,{message:'Too many attempts. Please try again in 10 minutes.'});return;}
      let body='';let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>20000){json(res,413,{message:'Your message is too large. Please keep it below 5,000 characters.'});return;}body+=chunk;}
      let data;try{data=JSON.parse(body);}catch{json(res,400,{message:'Your enquiry could not be read. Please try again.'});return;}
      rate.count++;recent.set(address,rate);
      const error=validateEnquiry(data);if(error){json(res,400,{message:error});return;}
      const enquiry={id:randomUUID(),receivedAt:new Date().toISOString(),name:data.name.trim(),email:data.email.trim(),company:data.company.trim(),phone:(data.phone||'').trim(),interest:data.interest,message:data.message.trim(),consent:true};
      await mkdir(dataDir,{recursive:true});await appendFile(path.join(dataDir,'enquiries.jsonl'),JSON.stringify(enquiry)+'\n',{mode:0o600});
      json(res,201,{message:'Your enquiry has been saved successfully in this local preview. It has not been emailed to Vallyron.',id:enquiry.id});return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    let decoded;try{decoded=decodeURIComponent(url.pathname);}catch{res.writeHead(400);res.end('Invalid URL');return;}
    const filePath=path.resolve(root,'.'+decoded.replaceAll('\\','/'));
    if(filePath!==root&&!filePath.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    let target=filePath,statusCode=200;
    try{if((await stat(target)).isDirectory()){if(!url.pathname.endsWith('/')){res.writeHead(308,{Location:url.pathname+'/'+url.search});res.end();return;}target=path.join(target,'index.html');}await stat(target);}catch{target=path.join(root,'404.html');statusCode=404;}
    const body=await readFile(target);
    res.writeHead(statusCode,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Content-Length':body.length,'Cache-Control':path.extname(target)==='.html'?'no-cache':'public, max-age=3600'});
    res.end(req.method==='HEAD'?undefined:body);
  }catch(error){if(!res.headersSent)json(res,500,{message:'The request could not be completed. Please try again.'});else res.end();console.error('Request failed:',error.code||error.name);}
});
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))server.listen(port,'127.0.0.1',()=>console.log(`Local: http://localhost:${port}`));
