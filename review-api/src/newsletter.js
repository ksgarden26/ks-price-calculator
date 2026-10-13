// KS Garden Weekly newsletter: Brevo double opt-in, owner statistics and optional weekly campaigns.
// API keys stay in Cloudflare secrets. Contacts live in Brevo, not in the customer CRM.
const emailOK=v=>typeof v==="string"&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const makeResponse=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const escapeHtml=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const configured=env=>Boolean(env.DB&&env.SESSION_SECRET&&env.BREVO_API_KEY&&Number.isSafeInteger(Number(env.BREVO_LIST_ID))&&Number(env.BREVO_LIST_ID)>0&&Number.isSafeInteger(Number(env.BREVO_DOI_TEMPLATE_ID))&&Number(env.BREVO_DOI_TEMPLATE_ID)>0);
async function brevo(env,path,opts={}){
  const r=await fetch("https://api.brevo.com/v3"+path,{
    ...opts,headers:{"api-key":env.BREVO_API_KEY,"accept":"application/json",...(opts.body?{"content-type":"application/json"}:{}),...(opts.headers||{})}
  });
  const body=await r.text();
  let data={};try{data=JSON.parse(body)}catch{}
  if(!r.ok){console.error("Brevo request failed:",path,"status",r.status,"code",data.code||"unknown");throw Error("Mailing provider unavailable ("+r.status+").")}
  return data;
}
async function hashIp(request,env){
  const ip=request.headers.get("cf-connecting-ip")||"unknown";
  const hashed=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(env.SESSION_SECRET+":newsletter:"+ip));
  return [...new Uint8Array(hashed)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function ready(env){
  if(!configured(env))return false;
  try{await env.DB.prepare("SELECT last_at FROM newsletter_request_limits LIMIT 1").first();return true;}catch{return false;}
}
export async function handleNewsletter(request,env,auth){
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,""),method=request.method;
  if(path==="/api/newsletter/status"&&method==="GET")
    return makeResponse({configured:await ready(env)});
  if(path==="/api/newsletter/subscribe"&&method==="POST"){
    if(!(await ready(env)))return makeResponse({error:"Newsletter subscriptions are not available yet."},503);
    if(request.headers.get("origin")!==url.origin)return makeResponse({error:"Invalid request origin."},403);
    if(Number(request.headers.get("content-length")||0)>2000)return makeResponse({error:"Request too large."},413);
    let payload;try{const txt=await request.text();if(txt.length>2000)throw Error();payload=JSON.parse(txt)}catch{return makeResponse({error:"Invalid submission."},400)}
    if(payload.website)return makeResponse({success:true},200);
    const email=typeof payload.email==="string"?payload.email.trim().toLowerCase():"";
    if(!emailOK(email)||payload.consent!==true)return makeResponse({error:"Enter a valid email and tick the newsletter consent box."},400);
    const key=await hashIp(request,env),now=Date.now();
    const recent=await env.DB.prepare("SELECT last_at FROM newsletter_request_limits WHERE ip_hash=?").bind(key).first();
    if(recent&&now-Number(recent.last_at)<15*60*1000)return makeResponse({error:"Please wait 15 minutes before trying again."},429);
    // Reserve a request slot before contacting Brevo. Avoid disclosing whether an address exists.
    await env.DB.prepare("INSERT INTO newsletter_request_limits (ip_hash,last_at) VALUES (?,?) ON CONFLICT(ip_hash) DO UPDATE SET last_at=excluded.last_at").bind(key,now).run();
    await env.DB.prepare("DELETE FROM newsletter_request_limits WHERE last_at<?").bind(now-30*86400000).run();
    const redirectUrl="https://ksgardenservices.co.uk/newsletter.html?confirmed=1";
    try{
      await brevo(env,"/contacts/doubleOptinConfirmation",{
        method:"POST",
        body:JSON.stringify({
          email,
          includeListIds:[Number(env.BREVO_LIST_ID)],
          templateId:Number(env.BREVO_DOI_TEMPLATE_ID),
          redirectionUrl:redirectUrl
        })
      });
    }catch(err){return makeResponse({error:"We couldn't send a confirmation right now. Please try again later."},503)}
    return makeResponse({success:true,message:"Check your email for a confirmation link."},201);
  }
  if(path==="/api/admin/newsletter/stats"&&method==="GET"){
    if(!(await auth(request,env)))return makeResponse({error:"Please sign in."},401);
    if(!configured(env))return makeResponse({connected:false,count:null,lastIssue:null,autoSendEnabled:false});
    try{
      const [list,recent]=await Promise.all([
        brevo(env,"/contacts/lists/"+encodeURIComponent(String(env.BREVO_LIST_ID))),
        env.DB.prepare("SELECT issue_date,status,campaign_id,created_at FROM newsletter_campaign_runs ORDER BY issue_date DESC LIMIT 1").first()
      ]);
      return makeResponse({connected:true,count:Number(list.totalSubscribers)||0,lastIssue:recent||null,autoSendEnabled:env.NEWSLETTER_AUTO_SEND==="true"});
    }catch{return makeResponse({connected:false,count:null,lastIssue:null,autoSendEnabled:false,error:"Check Brevo access and newsletter database migration."},503)}
  }
  return makeResponse({error:"Not found."},404);
}
function monthlyTip(month){
 const tips=[
 "January: Check trees and shrubs after high winds, but leave frosty lawns undisturbed.",
 "February: Watch for early bulbs and plan pruning on suitable deciduous shrubs.",
 "March: Start spring tidy-ups gently and avoid mowing waterlogged lawns.",
 "April: Keep an eye on fresh lawn growth and spring weeds without disturbing nesting birds.",
 "May: Check emerging growth, water new plantings when dry and consider leaving some lawn longer for pollinators.",
 "June: Mulch borders after rain and look out for pest or drought stress.",
 "July: Water deeply during dry spells and raise mower height during heat.",
 "August: Deadhead selected plants and keep new shrubs watered when conditions are dry.",
 "September: Consider lawn renovation if the soil has enough warmth and moisture.",
 "October: Clear slippery leaves from paths while leaving safe, sheltered wildlife corners undisturbed.",
 "November: Protect containers in hard frost and plant suitable bare-root stock in unfrozen soil.",
 "December: Maintain clear paths, inspect trees after storms and plan next season's garden jobs."
 ];return tips[month]||tips[9];
}
async function recentArticles(env,now){
  let combined=[];
  if(env.DB){
    const db=await env.DB.prepare("SELECT id,title,category,body,image_url,source_url,created_at,updated_at,published FROM news_posts WHERE published=1 ORDER BY created_at DESC LIMIT 80").all();
    combined.push(...(db.results||[]));
  }
  const source=env.NEWSLETTER_NEWS_JSON_URL||"https://ksgardenservices.co.uk/news-data.json";
  if(/^https:\/\//.test(source)){
    try{const r=await fetch(source,{headers:{"accept":"application/json"}});if(r.ok){const json=await r.json();if(Array.isArray(json.articles))combined.push(...json.articles)}}catch(e){console.warn("Newsletter seed fetch failed:",String(e))}
  }
  const articles=new Map();
  for(const a of combined)if(a&&a.id&&a.title&&a.body&&a.published!==0&&a.published!==false)articles.set(a.id,a);
  return [...articles.values()].filter(a=>{
    const time=Date.parse(a.created_at||a.updated_at||"");
    return Number.isFinite(time)&&time<=now&&time>=now-7*86400000;
  }).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,5);
}
function newsletterHtml(articles,date){
 const formatted=new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/London"}).format(date);
 const cards=articles.map(a=>{
  const intro=String(a.body).split(/\n\s*\n/)[0].replace(/\s+/g," ").slice(0,250);
  return '<div style="padding:16px 0;border-bottom:1px solid #dfe8dc"><p style="font-size:12px;color:#43714c;text-transform:uppercase">'+escapeHtml(a.category||"Garden news")+'</p><h2 style="font-size:21px;color:#1f3c2b">'+escapeHtml(a.title)+'</h2><p>'+escapeHtml(intro)+'…</p><p><a href="https://ksgardenservices.co.uk/news" style="color:#276043">Read on our news hub →</a></p></div>';
 }).join("");
 return '<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f8f4;color:#294532;line-height:1.6;margin:0;padding:20px"><div style="max-width:620px;margin:auto;background:#fff;padding:24px;border-radius:15px"><p style="font-weight:700;color:#356a45">KS GARDEN SERVICES</p><h1 style="font-size:30px;margin-bottom:0">The KS Garden Weekly 🌿</h1><p style="color:#64786c">'+escapeHtml(formatted)+'</p><p>Hi there! Here’s a little garden inspiration for your week, from KS Garden Services.</p><p><strong>This week’s gardening tip:</strong> '+escapeHtml(monthlyTip(date.getUTCMonth()))+'</p><h2>Fresh from the News & Advice Hub</h2>'+cards+'<p style="padding-top:16px">Need a hand with your garden? <a href="https://ksgardenservices.co.uk/contact" style="color:#276043">Get in touch</a>.</p><p>Keeping Gardens Looking Their Best.<br>Karl · KS Garden Services</p><hr style="border:0;border-top:1px solid #ddd"><p style="font-size:12px;color:#6b766f">You are receiving this email because you confirmed a subscription to The KS Garden Weekly. <a href="{{ unsubscribe }}">Unsubscribe</a> at any time. <a href="https://ksgardenservices.co.uk/privacy">Privacy information</a>.</p></div></body></html>';
}
export async function sendWeeklyNewsletter(env){
 // Explicit opt-in at deployment: never send to the mailing list without enabling it.
 if(!configured(env)||!env.DB||env.NEWSLETTER_AUTO_SEND!=="true"||!emailOK(env.BREVO_SENDER_EMAIL))return {status:"not_enabled"};
 const now=new Date(), day=now.getUTCDay();
 if(day!==0)return {status:"not_sunday"};
 const issue=now.toISOString().slice(0,10);
 const stories=await recentArticles(env,now.getTime());
 if(!stories.length)return {status:"no_fresh_stories"};
 const count=await brevo(env,"/contacts/lists/"+encodeURIComponent(String(env.BREVO_LIST_ID)));
 if(Number(count.totalSubscribers)<1)return {status:"no_subscribers"};
 const claimed=await env.DB.prepare("INSERT OR IGNORE INTO newsletter_campaign_runs (issue_date,status,created_at) VALUES (?,'preparing',?)").bind(issue,now.toISOString()).run();
 if(!claimed.meta?.changes)return {status:"already_prepared"};
 let campaignId=null;
 try{
  const campaign=await brevo(env,"/emailCampaigns",{
    method:"POST",
    body:JSON.stringify({
      name:"The KS Garden Weekly — "+issue,
      subject:"🌿 Your KS Garden Weekly — "+new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",timeZone:"Europe/London"}).format(now),
      sender:{name:"KS Garden Services",email:env.BREVO_SENDER_EMAIL},
      replyTo:"info@ksgardenservices.co.uk",
      recipients:{listIds:[Number(env.BREVO_LIST_ID)]},
      htmlContent:newsletterHtml(stories,now),
      previewText:"Your weekly garden jobs, plant inspiration and local gardening news."
    })
  });
  campaignId=Number(campaign.id);
  if(!Number.isSafeInteger(campaignId)||campaignId<=0)throw Error("Brevo did not return a campaign ID.");
  await env.DB.prepare("UPDATE newsletter_campaign_runs SET campaign_id=?,status='created' WHERE issue_date=?").bind(campaignId,issue).run();
  await brevo(env,"/emailCampaigns/"+campaignId+"/sendNow",{method:"POST"});
  await env.DB.prepare("UPDATE newsletter_campaign_runs SET status='submitted' WHERE issue_date=?").bind(issue).run();
  return {status:"submitted",campaignId};
 }catch(e){
  console.error("Weekly campaign failed:",String(e));
  await env.DB.prepare("UPDATE newsletter_campaign_runs SET status='failed',campaign_id=? WHERE issue_date=?").bind(campaignId,issue).run();
  return {status:"failed",campaignId};
 }
}
