// KS Garden Services review API — Cloudflare Worker + D1.
// Configure DB, SESSION_SECRET, ADMIN_PASSWORD and RESEND_API_KEY before deploying.
const COOKIE = "ks_review_session";
const encoder = new TextEncoder();

function response(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {
    status, headers: {"content-type":"application/json; charset=utf-8", "cache-control":"no-store", "x-content-type-options":"nosniff", ...headers}
  });
}
function clean(value, limit) { return typeof value === "string" ? value.trim().slice(0, limit + 1) : ""; }
function isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
function html(value) { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function compare(a, b) {
  if(typeof a!=="string" || typeof b!=="string") return false;
  let difference=a.length^b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++) difference |= (a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return difference===0;
}
function encode64(s) { return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
function decode64(s) { return atob(s.replace(/-/g,"+").replace(/_/g,"/")); }
async function signature(secret, text) {
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes=await crypto.subtle.sign("HMAC",key,encoder.encode(text));
  return encode64(String.fromCharCode(...new Uint8Array(bytes)));
}
async function userSession(request, env) {
  const value=request.headers.get("cookie")?.split(";").map(v=>v.trim()).find(v=>v.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);
  if(!value) return false;
  const [payload, mac]=value.split(".");
  if(!payload||!mac||!compare(await signature(env.SESSION_SECRET,payload),mac)) return false;
  try { const data=JSON.parse(decode64(payload)); return data.role==="owner" && Number.isFinite(data.exp) && data.exp > Date.now(); }
  catch { return false; }
}
async function makeCookie(env) {
  const payload=encode64(JSON.stringify({role:"owner",exp:Date.now()+12*60*60*1000}));
  return COOKIE+"="+payload+"."+await signature(env.SESSION_SECRET,payload)+"; Path=/api/reviews; Max-Age=43200; HttpOnly; Secure; SameSite=Strict";
}
function originAllowed(request) {
  const origin=request.headers.get("origin");
  return !!origin && origin===new URL(request.url).origin;
}
async function body(request) {
  if(Number(request.headers.get("content-length")||0)>10000) throw Error("Request too large");
  const txt=await request.text();
  if(txt.length>10000) throw Error("Request too large");
  return JSON.parse(txt);
}
async function ipKey(request, env) {
  const ip=request.headers.get("cf-connecting-ip")||"unknown";
  const hash=await crypto.subtle.digest("SHA-256",encoder.encode(env.SESSION_SECRET+":"+ip));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
}
async function sendMail(env, {to,subject,htmlBody,replyTo}) {
  if(!env.RESEND_API_KEY || !env.REVIEW_FROM_EMAIL) return false;
  const result=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({
      from:env.REVIEW_FROM_EMAIL,
      to:[to],
      subject,
      html:htmlBody,
      ...(replyTo?{reply_to:replyTo}:{})
    })
  });
  if(!result.ok) { console.error("Review email failed",result.status,(await result.text()).slice(0,300)); return false; }
  return true;
}
function publicReview(r) {
  return {id:r.id,name:r.name,rating:r.rating,message:r.message,created_at:r.created_at,owner_reply:r.owner_reply,replied_at:r.replied_at};
}
async function handle(request,env) {
  if(!env.DB || !env.SESSION_SECRET) return response({error:"Review system not configured."},503);
  const url=new URL(request.url);
  const path=url.pathname.replace(/\/+$/,"");
  const method=request.method;
  if(method==="GET" && path==="/api/reviews") {
    const result=await env.DB.prepare("SELECT id,name,rating,message,created_at,owner_reply,replied_at FROM reviews ORDER BY created_at DESC LIMIT 150").all();
    return response({reviews:(result.results||[]).map(publicReview)});
  }
  if(method==="POST" && path==="/api/reviews") {
    if(!originAllowed(request)) return response({error:"Invalid request origin."},403);
    let data;try{data=await body(request);}catch{return response({error:"Invalid form submission."},400);}
    if(data.website) return response({success:true},201);
    const name=clean(data.name,80),email=clean(data.email,254),message=clean(data.message,2000);
    const rating=Number(data.rating);
    if(name.length<2||name.length>80||message.length<10||message.length>2000||!Number.isInteger(rating)||rating<1||rating>5||(email&&!isEmail(email)))
      return response({error:"Enter your name, rating and a review of 10–2,000 characters."},400);
    if(data.agreed!==true) return response({error:"Please confirm your review may be published."},400);
    const key=await ipKey(request,env), now=Date.now();
    const state=await env.DB.prepare("SELECT last_review_at FROM rate_limits WHERE ip_hash=?").bind(key).first();
    if(state && now-Number(state.last_review_at)<15*60*1000) return response({error:"Please wait 15 minutes before submitting another review."},429);
    const id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO reviews (id,name,rating,message,email,email_opt_in) VALUES (?,?,?,?,?,?)")
      .bind(id,name,rating,message,email||null,email&&data.email_opt_in===true?1:0).run();
    await env.DB.prepare("INSERT INTO rate_limits (ip_hash,last_review_at) VALUES (?,?) ON CONFLICT(ip_hash) DO UPDATE SET last_review_at=excluded.last_review_at")
      .bind(key,now).run();
    const adminLink=env.REVIEW_ADMIN_URL||"https://ksgardenservices.co.uk/review-admin.html";
    const text="<p>A new <strong>"+rating+"-star</strong> review has been posted to the KS Garden Services website.</p>"+
      "<p><strong>Customer:</strong> "+html(name)+"</p><blockquote>"+html(message).replace(/\n/g,"<br>")+"</blockquote>"+
      "<p><a href=\""+html(adminLink)+"\">Open review dashboard to reply</a></p>";
    let notified=false;
    try{notified=await sendMail(env,{to:env.NOTIFY_TO_EMAIL||"info@ksgardenservices.co.uk",subject:"New "+rating+"-star KS Garden Services review",htmlBody:text,replyTo:email||undefined});}
    catch(e){console.error("Notification error",e);}
    await env.DB.prepare("UPDATE reviews SET notification_sent=? WHERE id=?").bind(notified?1:0,id).run();
    return response({success:true,id},201);
  }
  if(method==="POST" && path==="/api/reviews/admin/login") {
    if(!originAllowed(request)) return response({error:"Invalid request origin."},403);
    if(!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length<16) return response({error:"Owner login not configured."},503);
    const key=await ipKey(request,env),now=Date.now();
    const state=await env.DB.prepare("SELECT login_failed,login_window_at,lock_until FROM rate_limits WHERE ip_hash=?").bind(key).first();
    if(state && Number(state.lock_until)>now) return response({error:"Too many attempts. Try again later."},429);
    let data;try{data=await body(request);}catch{return response({error:"Invalid request."},400);}
    if(!compare(data.password,env.ADMIN_PASSWORD)) {
      const attempts=state&&now-Number(state.login_window_at)<15*60*1000?Number(state.login_failed)+1:1;
      await env.DB.prepare("INSERT INTO rate_limits (ip_hash,login_failed,login_window_at,lock_until) VALUES (?,?,?,?) ON CONFLICT(ip_hash) DO UPDATE SET login_failed=excluded.login_failed,login_window_at=excluded.login_window_at,lock_until=excluded.lock_until")
        .bind(key,attempts,now,attempts>=5?now+30*60*1000:0).run();
      return response({error:"Incorrect password."},401);
    }
    await env.DB.prepare("INSERT INTO rate_limits (ip_hash,login_failed,login_window_at,lock_until) VALUES (?,0,0,0) ON CONFLICT(ip_hash) DO UPDATE SET login_failed=0,login_window_at=0,lock_until=0").bind(key).run();
    return response({success:true},200,{"set-cookie":await makeCookie(env)});
  }
  if(path.startsWith("/api/reviews/admin")) {
    if(!(await userSession(request,env))) return response({error:"Please sign in."},401);
    if(method==="GET" && path==="/api/reviews/admin") {
      const result=await env.DB.prepare("SELECT id,name,rating,message,email,email_opt_in,owner_reply,replied_at,created_at,notification_sent FROM reviews ORDER BY created_at DESC LIMIT 250").all();
      return response({reviews:result.results||[]});
    }
    if(method==="POST" && path==="/api/reviews/admin/logout") {
      if(!originAllowed(request)) return response({error:"Invalid request origin."},403);
      return response({success:true},200,{"set-cookie":COOKIE+"=; Path=/api/reviews; Max-Age=0; HttpOnly; Secure; SameSite=Strict"});
    }
    const match=path.match(/^\/api\/reviews\/admin\/([0-9a-f-]{36})\/reply$/);
    if(method==="PUT" && match) {
      if(!originAllowed(request)) return response({error:"Invalid request origin."},403);
      let data;try{data=await body(request);}catch{return response({error:"Invalid reply."},400);}
      const reply=clean(data.reply,1500);
      if(!reply||reply.length>1500) return response({error:"Your response must be 1–1,500 characters."},400);
      const record=await env.DB.prepare("SELECT name,email,email_opt_in FROM reviews WHERE id=?").bind(match[1]).first();
      if(!record) return response({error:"Review not found."},404);
      const date=new Date().toISOString();
      await env.DB.prepare("UPDATE reviews SET owner_reply=?,replied_at=? WHERE id=?").bind(reply,date,match[1]).run();
      let emailSent=false;
      if(data.email_customer===true && record.email && record.email_opt_in) {
        try {
          emailSent=await sendMail(env,{
            to:record.email,subject:"A response to your KS Garden Services review",
            htmlBody:"<p>Hi "+html(record.name)+",</p><p>Thank you for your review. Here is Karl's response:</p><blockquote>"+html(reply).replace(/\n/g,"<br>")+"</blockquote><p>KS Garden Services</p>"
          });
        }catch(e){console.error("Customer response email failed",e);}
      }
      return response({success:true,email_requested:data.email_customer===true,email_sent:emailSent});
    }
  }
  return response({error:"Not found."},404);
}
export default {
  async fetch(request, env) {
    try { return await handle(request,env); }
    catch(error) { console.error("Review API error",error); return response({error:"The review system is temporarily unavailable."},500); }
  }
};