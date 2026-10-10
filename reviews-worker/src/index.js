/**
 * KS Garden Services review API — Cloudflare Worker + D1.
 * Deploy on ks(gardenservices).co.uk/api/*, preserving existing website routes.
 * Secrets: ADMIN_TOKEN (long random string), RESEND_API_KEY (optional for email).
 * D1 binding: REVIEWS_DB.
 * The owner can publish EVERY rating, 1–5, and append a separate public reply.
 */
const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const answer=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
const trim=(v,max)=>typeof v==="string"?v.trim().slice(0,max):"";
const noStore={"cache-control":"no-store"};
const validEmail=(s)=>!s||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const rawText=async(req)=>{const s=await req.text();if(s.length>12000)throw new Error("Payload too large");return JSON.parse(s)};
const expectedOrigin=(req)=>new URL(req.url).origin;
function sameOrigin(req) {
  const origin=req.headers.get("Origin");
  return !origin||origin===expectedOrigin(req);
}
async function hash(s){const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(buf)].map(v=>v.toString(16).padStart(2,"0")).join("")}
function constantTime(a,b){const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);return diff===0}
function authorized(req,env){const auth=req.headers.get("Authorization")||"";return Boolean(env.ADMIN_TOKEN&&env.ADMIN_TOKEN.length>=24&&auth.startsWith("Bearer ")&&constantTime(auth.slice(7),env.ADMIN_TOKEN))}
async function notify(env,recipient,subject,message) {
  if(!env.RESEND_API_KEY)return false;
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({from:env.MAIL_FROM||"KS Garden Services <reviews@ksgardenservices.co.uk>",to:[recipient],subject,text:message})
  });
  if(!response.ok){console.error("Review notification email HTTP status:",response.status);return false}
  return true;
}
async function rateLimit(req,env) {
  const ip=req.headers.get("CF-Connecting-IP")||"unknown";
  const today=new Date().toISOString().slice(0,10);
  const fingerprint=await hash((env.REVIEW_RATE_SALT||env.ADMIN_TOKEN)+":"+today+":"+ip);
  await env.REVIEWS_DB.prepare("INSERT INTO review_rate_limits (fingerprint, submission_count, day) VALUES (?,1,?) ON CONFLICT(fingerprint) DO UPDATE SET submission_count=submission_count+1").bind(fingerprint,today).run();
  const row=await env.REVIEWS_DB.prepare("SELECT submission_count FROM review_rate_limits WHERE fingerprint=?").bind(fingerprint).first();
  return (row?.submission_count||0)<=5;
}
export default {
  async fetch(req,env) {
    try{
      const url=new URL(req.url),p=url.pathname.replace(/\/$/,""),method=req.method;
      if(!p.startsWith("/api/"))return answer({error:"Not found"},404);
      if(!env.REVIEWS_DB)return answer({error:"Review storage not configured"},503);
      if(method!=="GET"&&!sameOrigin(req))return answer({error:"Invalid origin"},403);
      if(p==="/api/reviews"&&method==="GET"){
        const rows=await env.REVIEWS_DB.prepare("SELECT id, name, stars, comment, created_at, owner_reply, replied_at FROM reviews WHERE status='published' ORDER BY created_at DESC LIMIT 100").all();
        return answer({reviews:rows.results||[]});
      }
      if(p==="/api/reviews"&&method==="POST"){
        let data;
        try{data=await rawText(req)}catch(e){return answer({error:"Invalid review data"},400)}
        if(data.website)return answer({ok:true}); // honeypot: quietly discard bots
        const name=trim(data.name,80),email=trim(data.email,180),comment=trim(data.comment,2000);
        const stars=Number(data.stars);
        if(name.length<2||comment.length<8||!Number.isInteger(stars)||stars<1||stars>5||!validEmail(email))
          return answer({error:"Enter your name, a 1–5 star rating and a review of at least 8 characters."},400);
        const agreed=data.emailConsent===true&&Boolean(email);
        if(!await rateLimit(req,env))return answer({error:"Too many reviews submitted. Please try again tomorrow."},429);
        const id=crypto.randomUUID(),created=new Date().toISOString();
        await env.REVIEWS_DB.prepare("INSERT INTO reviews (id,name,email,stars,comment,created_at,status,email_consent) VALUES (?,?,?,?,?,?,'pending',?)")
          .bind(id,name,email||null,stars,comment,created,agreed?1:0).run();
        const adminLink=env.ADMIN_URL||"https://ksgardenservices.co.uk/review-admin.html";
        try{await notify(env,"info@ksgardenservices.co.uk",
          "New "+stars+"-star KS Garden Services review",
          "New website review\n\nName: "+name+"\nRating: "+stars+"/5\nReview: "+comment+"\n\nOpen the secure review dashboard to publish and reply:\n"+adminLink+"\n\nReview ID: "+id
        )}catch(e){console.error("Review notification failed",String(e))}
        return answer({ok:true,message:"Thanks for reviewing KS Garden Services. Your review has been received and will appear once checked for spam."},201);
      }
      if(p.startsWith("/api/admin/")){
        if(!authorized(req,env))return answer({error:"Your admin access key is incorrect."},401);
        if(p==="/api/admin/reviews"&&method==="GET"){
          const result=await env.REVIEWS_DB.prepare("SELECT id,name,email,stars,comment,created_at,status,owner_reply,replied_at,email_consent FROM reviews ORDER BY created_at DESC LIMIT 200").all();
          return answer({reviews:result.results||[]});
        }
        const match=p.match(/^\/api\/admin\/reviews\/([0-9a-f-]{36})\/(reply|publish)$/);
        if(match&&method==="POST"){
          const id=match[1],action=match[2];
          const row=await env.REVIEWS_DB.prepare("SELECT id,name,email,stars,comment,status,email_consent FROM reviews WHERE id=?").bind(id).first();
          if(!row)return answer({error:"Review not found"},404);
          if(action==="publish"){
            await env.REVIEWS_DB.prepare("UPDATE reviews SET status='published',published_at=? WHERE id=?").bind(new Date().toISOString(),id).run();
            return answer({ok:true});
          }
          let data;
          try{data=await rawText(req)}catch(e){return answer({error:"Invalid response"},400)}
          const reply=trim(data.reply,1600);
          if(reply.length<3)return answer({error:"Please write a response before publishing."},400);
          await env.REVIEWS_DB.prepare("UPDATE reviews SET owner_reply=?, replied_at=? WHERE id=?").bind(reply,new Date().toISOString(),id).run();
          if(row.email&&row.email_consent===1){
            try{await notify(env,row.email,"Karl has replied to your KS Garden Services review",
              "Hello "+row.name+",\n\nThank you for leaving a review of KS Garden Services. Karl has replied:\n\n"+reply+
              "\n\nYou can see the response on https://ksgardenservices.co.uk/reviews\n\nKS Garden Services")}
            catch(e){console.error("Customer reply email failed",String(e))}
          }
          return answer({ok:true});
        }
        return answer({error:"Not found"},404);
      }
      return answer({error:"Not found"},404);
    }catch(e){console.error("Review API error",String(e));return answer({error:"Something went wrong. Please try again later."},500)}
  }
};
