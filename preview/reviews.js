(() => {
"use strict";
const list=document.getElementById("reviewList"), summary=document.getElementById("reviewSummary"), form=document.getElementById("reviewForm"), notice=document.getElementById("reviewFormStatus");
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function niceDate(s){const d=new Date(s);return Number.isNaN(d.getTime())?"":d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});}
const oldReviews=Array.isArray(window.KS_LEGACY_REVIEWS)?window.KS_LEGACY_REVIEWS:[];
const oldReviewIds=new Set(oldReviews.map(r=>r.id));
function addExisting(reviews, replies={}){
  const live=Array.isArray(reviews)?reviews:[];
  const existing=new Set(live.map(r=>String(r.name||"").trim().toLowerCase()+"|"+String(r.message||"").trim()));
  return [...live,...oldReviews.filter(r=>!live.some(x=>x.id===r.id)&&!existing.has(r.name.toLowerCase()+"|"+r.message.trim())).map(r=>({...r,owner_reply:replies[r.id]||r.owner_reply||""}))];
}
function showReviews(reviews){
 list.replaceChildren();
 if(!reviews.length){list.append(node("p","review-message","No website reviews have been submitted yet. Be the first to share your experience."));summary.textContent="";return;}
 const average=reviews.reduce((sum,r)=>sum+Number(r.rating),0)/reviews.length;
 summary.replaceChildren(node("strong","",average.toFixed(1)+" / 5"),node("span","stars","★".repeat(Math.round(average))+"☆".repeat(5-Math.round(average))),node("p","small",reviews.length+" customer review"+(reviews.length===1?"":"s")));
 for(const r of reviews){
  const card=node("article","review-card"),head=node("div","review-card-head"),who=node("div");
  who.append(node("div","review-name",r.name));
  if(!r.legacy&&!oldReviewIds.has(r.id)&&r.created_at)who.append(node("div","review-date",niceDate(r.created_at)));
  const stars=node("div","stars","★".repeat(r.rating)+"☆".repeat(5-r.rating));
  stars.setAttribute("aria-label",r.rating+" out of 5 stars");head.append(who,stars);
  card.append(head,node("p","review-text",r.message));
  if(r.owner_reply){const reply=node("div","review-response");reply.append(node("strong","","Response from Karl – Owner, KS Garden Services"),node("p","",r.owner_reply));card.append(reply);}
  list.append(card);
 }
}
async function load(){
 try{
  const [r,legacyR]=await Promise.all([
    fetch("/api/reviews",{cache:"no-store"}),
    fetch("/api/reviews/legacy-replies",{cache:"no-store"}).catch(()=>null)
  ]);
  if(!r.ok)throw Error("Reviews temporarily unavailable");
  const live=await r.json(),publishedReplies=legacyR&&legacyR.ok?await legacyR.json():{replies:[]};
  const replies=Object.fromEntries((publishedReplies.replies||[]).map(r=>[r.review_id,r.owner_reply]));
  showReviews(addExisting(live.reviews||[],replies));
  form.hidden=false;
  const hint=document.getElementById("reviewOfflineMessage");if(hint)hint.hidden=true;
 }catch{
  showReviews(addExisting([]));
  form.hidden=true;
  const hint=document.getElementById("reviewOfflineMessage");
  if(hint)hint.hidden=false;
 }
}
form.addEventListener("submit",async e=>{
 e.preventDefault();notice.classList.remove("error");notice.textContent="";
 const fd=new FormData(form), data={
  name:String(fd.get("name")||"").trim(),email:String(fd.get("email")||"").trim(),
  rating:Number(fd.get("rating")),message:String(fd.get("message")||"").trim(),
  email_opt_in:!!fd.get("email_opt_in"),agreed:!!fd.get("agreed"),website:String(fd.get("website")||"")
 };
 if(data.name.length<2||!Number.isInteger(data.rating)||data.rating<1||data.rating>5||data.message.length<10||!data.agreed){
  notice.textContent="Please enter your name, choose a star rating, write at least 10 characters and agree to publication.";
  notice.classList.add("error");return;
 }
 const button=document.getElementById("submitReview");button.disabled=true;button.textContent="Submitting…";
 try{
  const r=await fetch("/api/reviews",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
  const result=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(result.error||"Review submission is temporarily unavailable.");
  notice.textContent="Thank you — your review has been published. I appreciate you taking the time to leave feedback!";
  form.reset();await load();
 }catch(err){notice.classList.add("error");notice.textContent=err.message||"Unable to submit review right now.";}
 finally{button.disabled=false;button.textContent="Submit my review";}
});
load();
})();