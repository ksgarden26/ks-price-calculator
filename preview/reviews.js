(() => {
"use strict";
const list=document.getElementById("reviewList"), summary=document.getElementById("reviewSummary"), form=document.getElementById("reviewForm"), notice=document.getElementById("reviewFormStatus");
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function niceDate(s){const d=new Date(s);return Number.isNaN(d.getTime())?"":d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});}
function showReviews(reviews){
 list.replaceChildren();
 if(!reviews.length){list.append(node("p","review-message","No website reviews have been submitted yet. Be the first to share your experience."));summary.textContent="";return;}
 const average=reviews.reduce((sum,r)=>sum+Number(r.rating),0)/reviews.length;
 summary.replaceChildren(node("strong","",average.toFixed(1)+" / 5"),node("span","stars","★★★★★"),node("p","small",reviews.length+" customer review"+(reviews.length===1?"":"s")));
 for(const r of reviews){
  const card=node("article","review-card"),head=node("div","review-card-head"),who=node("div");
  who.append(node("div","review-name",r.name),node("div","review-date",niceDate(r.created_at)));
  const stars=node("div","stars","★".repeat(r.rating)+"☆".repeat(5-r.rating));
  stars.setAttribute("aria-label",r.rating+" out of 5 stars");head.append(who,stars);
  card.append(head,node("p","review-text",r.message));
  if(r.owner_reply){const reply=node("div","review-response");reply.append(node("strong","","Response from Karl – Owner, KS Garden Services"),node("p","",r.owner_reply));card.append(reply);}
  list.append(card);
 }
}
async function load(){
 try{const r=await fetch("/api/reviews",{cache:"no-store"});if(!r.ok)throw Error("Reviews temporarily unavailable");showReviews((await r.json()).reviews||[]);}
 catch{list.replaceChildren(node("p","review-message","Reviews are temporarily unavailable. Please try again later."));}
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
  notice.textContent="Thank you — your review has been posted. I appreciate you taking the time to leave feedback!";
  form.reset();await load();
 }catch(err){notice.classList.add("error");notice.textContent=err.message||"Unable to submit review right now.";}
 finally{button.disabled=false;button.textContent="Submit my review";}
});
load();
})();