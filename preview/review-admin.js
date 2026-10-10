(() => {
"use strict";
const login=document.getElementById("reviewLogin"),loginForm=document.getElementById("reviewLoginForm");
const dashboard=document.getElementById("reviewDashboard"),list=document.getElementById("adminReviews");
const count=document.getElementById("adminCount"),loginMessage=document.getElementById("loginMessage");
function el(tag,cls,value) { const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e; }
function date(s){const d=new Date(s);return Number.isNaN(d.getTime())?"":d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});}
async function api(path,method="GET",payload){
 const options={method,credentials:"same-origin",cache:"no-store"};
 if(payload!==undefined){options.headers={"content-type":"application/json"};options.body=JSON.stringify(payload);}
 const r=await fetch(path,options),body=await r.json().catch(()=>({}));
 if(!r.ok){const error=Error(body.error||"Request failed. Please try again.");error.status=r.status;throw error;}
 return body;
}
function displaySignedOut(message=""){
 dashboard.hidden=true;login.hidden=false;loginMessage.textContent=message;loginMessage.classList.toggle("error",!!message);
}
function render(rows) {
 count.textContent=rows.length+" review"+(rows.length===1?"":"s")+" · "+rows.filter(r=>!!r.owner_reply).length+" answered";
 list.replaceChildren();
 if(!rows.length){list.append(el("p","review-message","There are no customer reviews to respond to yet."));return;}
 for(const r of rows){
  const card=el("article","review-card review-admin-card");
  const head=el("div","review-card-head"),who=el("div");
  who.append(el("div","review-name",r.name),el("div","review-date",date(r.created_at)));
  const stars=el("span","stars","★".repeat(r.rating)+"☆".repeat(5-r.rating));stars.setAttribute("aria-label",r.rating+" out of 5 stars");
  head.append(who,stars);card.append(head,el("p","review-text",r.message));
  if(r.owner_reply){const existing=el("div","review-response");existing.append(el("strong","","Your published response"),el("p","",r.owner_reply));card.append(existing);}
  card.append(el("p","admin-email",r.email?"Customer email: "+r.email:"Customer did not supply an email address."));
  if(r.notification_sent===0)card.append(el("p","admin-email","Note: notification email not confirmed for this review."));
  const form=el("form","form");
  const label=el("label","",r.owner_reply?"Edit your reply":"Write your public reply");
  const box=el("textarea");box.value=r.owner_reply||"";box.maxLength=1500;box.required=true;box.rows=4;
  box.placeholder="Thanks for taking the time to leave your review…";label.append(box);form.append(label);
  const mail=el("label","review-optin"),mailbox=el("input");
  mailbox.type="checkbox";mailbox.disabled=!(r.email&&r.email_opt_in);
  mail.append(mailbox,document.createTextNode(mailbox.disabled?" Customer has not opted in to an email reply":" Also email this reply to the customer"));
  form.append(mail);
  const actions=el("div","review-actions"),submit=el("button","btn",r.owner_reply?"Update public reply":"Publish public reply");
  submit.type="submit";const status=el("p","review-feedback");status.setAttribute("role","status");
  actions.append(submit,status);form.append(actions);
  form.addEventListener("submit",async event=>{
   event.preventDefault();status.textContent="";status.classList.remove("error");
   if(!box.value.trim()){status.textContent="Please write a reply.";status.classList.add("error");return;}
   submit.disabled=true;
   try {
    const result=await api("/api/reviews/admin/"+encodeURIComponent(r.id)+"/reply","PUT",{
      reply:box.value.trim(),email_customer:mailbox.checked
    });
    await load();
    const fresh=Array.from(list.querySelectorAll(".review-admin-card")).find(n=>n.dataset.reviewId===r.id);
    if(fresh){const msg=fresh.querySelector(".review-feedback");if(msg)msg.textContent=result.email_requested?(result.email_sent?"Reply published and emailed to the customer.":"Reply published, but the customer email could not be sent."):"Your public reply is published.";}
   }catch(e){if(e.status===401){displaySignedOut("Please sign in again.");return;}
    status.textContent=e.message;status.classList.add("error");}
   finally{submit.disabled=false;}
  });
  card.dataset.reviewId=r.id;card.append(form);list.append(card);
 }
}
async function load(){
 try{
  const data=await api("/api/reviews/admin");
  login.hidden=true;dashboard.hidden=false;render(data.reviews||[]);
 }catch(e){displaySignedOut(e.status===401?"":e.message);}
}
loginForm.addEventListener("submit",async event=>{
 event.preventDefault();loginMessage.textContent="";loginMessage.classList.remove("error");
 const button=loginForm.querySelector("button"),password=loginForm.elements.password.value;button.disabled=true;
 try{await api("/api/reviews/admin/login","POST",{password});loginForm.reset();await load();}
 catch(e){displaySignedOut(e.message);}
 finally{button.disabled=false;}
});
document.getElementById("reviewLogout").addEventListener("click",async()=>{
 try{await api("/api/reviews/admin/logout","POST");}catch{}
 displaySignedOut();
});
load();
})();