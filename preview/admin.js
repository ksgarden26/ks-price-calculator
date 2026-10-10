(() => {
"use strict";
const $=id=>document.getElementById(id);
const login=$("adminLogin"),app=$("adminApp"),loginForm=$("adminLoginForm");
const reviewList=$("adminReviews"),photosList=$("adminPhotoList"),newsList=$("adminNewsList");
const newsForm=$("adminNewsForm"),photoForm=$("adminPhotoForm");
let newsSeed=[],newsOverrides=[],currentTab="reviews";
const element=(tag,cls,text)=>{
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(text!==undefined)e.textContent=String(text);
  return e;
};
function alertStatus(text,error=false,local=$("globalStatus")){
  if(!local)return;
  local.textContent=text;local.classList.toggle("error",error);
}
async function api(path,method="GET",payload){
  const opts={method,cache:"no-store",credentials:"same-origin"};
  if(payload!==undefined){
    if(payload instanceof FormData) opts.body=payload;
    else{opts.headers={"content-type":"application/json"};opts.body=JSON.stringify(payload);}
  }
  const response=await fetch(path,opts);
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const e=new Error(data.error||"Unable to connect to the website admin service.");e.status=response.status;throw e;}
  return data;
}
function tab(name){
  currentTab=name;
  document.querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===name)));
  for(const t of ["reviews","photos","news","quotes"])$("tab-"+t).hidden=t!==name;
  window.location.hash=name;
}
async function session(){
  try{await api("/api/admin/session");login.hidden=true;app.hidden=false;await reload();}
  catch(e){login.hidden=false;app.hidden=true;alertStatus(e.status===401?"":"The secure dashboard needs Cloudflare setup before you can sign in.",!!(e.status!==401),$("loginStatus"));}
}
async function reload(){
  if(currentTab==="reviews")await loadReviews();
  if(currentTab==="photos")await loadPhotos();
  if(currentTab==="news")await loadNews();
  if(currentTab==="quotes")document.getElementById("ksQuoteFrame")?.contentWindow?.postMessage({type:"ks-refresh-quotes"},location.origin);
}
loginForm.addEventListener("submit",async event=>{
  event.preventDefault();const password=$("adminPassword").value;
  const button=loginForm.querySelector("button");button.disabled=true;
  try{await api("/api/admin/login","POST",{password});$("adminPassword").value="";login.hidden=true;app.hidden=false;alertStatus("Signed in.");await reload();}
  catch(e){alertStatus(e.message,true,$("loginStatus"));}
  finally{button.disabled=false;}
});
$("adminLogout").addEventListener("click",async()=>{
  try{await api("/api/admin/logout","POST")}catch{}
  login.hidden=false;app.hidden=true;alertStatus("Signed out.");$("adminPassword").value="";
});
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",async()=>{
  tab(b.dataset.tab);
  alertStatus("");
  try{await reload()}catch(e){alertStatus(e.message,true)}
}));
if(["reviews","news","photos","quotes"].includes(location.hash.slice(1)))tab(location.hash.slice(1));

function makeReview(r,legacy=false){
  const card=element("article","ks-admin-card");
  card.append(element("h3","",r.name),element("div","ks-stars","★".repeat(Number(r.rating)||0)+"☆".repeat(5-(Number(r.rating)||0))));
  card.append(element("p","",r.message));
  card.append(element("p","ks-admin-muted",legacy?"Existing customer review · no email needed":r.email?"Customer email on file":"No email supplied"));
  if(r.owner_reply){
    const prev=element("blockquote","ks-admin-news-preview");
    prev.append(element("strong","","Your current public response"),element("p","",r.owner_reply));
    card.append(prev);
  }
  const label=element("label","ks-admin-muted",r.owner_reply?"Update your public reply":"Write a public reply");
  const box=element("textarea");box.maxLength=1500;box.value=r.owner_reply||"";
  box.placeholder="Thank you for taking the time to leave a review…";
  label.append(box);card.append(label);
  const actions=element("div","ks-admin-actions"),save=element("button","btn",r.owner_reply?"Update reply":"Publish reply");
  save.type="button";const status=element("span","ks-admin-status");status.setAttribute("role","status");
  let emailCheckbox=null;
  if(!legacy&&r.email&&r.email_opt_in){
    const opt=element("label","ks-admin-check ks-admin-muted");
    emailCheckbox=element("input");emailCheckbox.type="checkbox";
    opt.append(emailCheckbox,document.createTextNode(" Also email the customer (opted in)"));
    card.append(opt);
  }
  actions.append(save,status);card.append(actions);
  save.addEventListener("click",async()=>{
    const reply=box.value.trim();
    if(!reply){alertStatus("Please write your reply.",true,status);return;}
    save.disabled=true;
    try{
      const path=legacy?"/api/admin/legacy-reviews/"+encodeURIComponent(r.id)+"/reply":"/api/reviews/admin/"+encodeURIComponent(r.id)+"/reply";
      const result=await api(path,"PUT",legacy?{reply}:{reply,email_customer:!!emailCheckbox?.checked});
      r.owner_reply=reply;
      save.textContent="Update reply";
      alertStatus(result.email_requested?(result.email_sent?"Reply published and emailed.":"Reply published. Customer email was not delivered."):"Reply published underneath the review.",false,status);
    }catch(e){alertStatus(e.message,true,status)}
    finally{save.disabled=false;}
  });
  return card;
}
async function loadReviews(){
  reviewList.replaceChildren(element("p","","Loading customer reviews…"));
  try{
    const result=await api("/api/admin/reviews");
    const replyMap=new Map((result.legacy_replies||[]).map(r=>[r.review_id,r.owner_reply]));
    const legacy=Array.isArray(window.KS_LEGACY_REVIEWS)?window.KS_LEGACY_REVIEWS:[];
    const already=new Set((result.reviews||[]).map(r=>r.id));
    const reviews=[...legacy.filter(r=>!already.has(r.id)).map(r=>({...r,owner_reply:replyMap.get(r.id)||""})),...(result.reviews||[])];
    reviewList.replaceChildren();
    if(!reviews.length){reviewList.append(element("p","ks-admin-muted","There are no reviews yet."));return}
    for(const r of reviews)reviewList.append(makeReview(r,!!r.legacy));
  }catch(e){reviewList.replaceChildren(element("p","ks-admin-status error",e.message));}
}

async function toJpeg(file){
  if(!file||!file.type.startsWith("image/"))throw new Error("Choose a photograph from your phone or computer.");
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=url;await image.decode();
    const ratio=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
    canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
    const ctx=canvas.getContext("2d");
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.82));
    if(!blob)throw new Error("This photo couldn't be prepared. Try a JPEG.");
    return blob;
  }finally{URL.revokeObjectURL(url)}
}
photoForm.addEventListener("submit",async event=>{
  event.preventDefault();const button=photoForm.querySelector("button[type=submit]");
  button.disabled=true;alertStatus("Preparing and uploading your photo…");
  try{
    const input=$("photoFile"),photo=await toJpeg(input.files[0]);
    const data=new FormData(photoForm);data.set("photo",photo,"garden.jpg");
    await api("/api/admin/gallery/upload","POST",data);
    photoForm.reset();alertStatus("Photo uploaded successfully.");await loadPhotos();
  }catch(e){alertStatus(e.message,true)}finally{button.disabled=false}
});
async function loadPhotos(){
  photosList.replaceChildren(element("p","","Loading photos…"));
  try{
    const r=await api("/api/admin/gallery");
    photosList.replaceChildren();
    if(!r.photos?.length){photosList.append(element("p","ks-admin-muted","No photos uploaded from this dashboard yet."));return;}
    for(const photo of r.photos){
      const card=element("article","ks-admin-card");
      const img=element("img","ks-admin-photo");img.src=photo.src;img.alt=photo.job||"Garden photo";img.loading="lazy";card.append(img);
      const job=element("input");job.value=photo.job||"";job.maxLength=100;job.setAttribute("aria-label","Job or photo title");
      const category=element("input");category.value=photo.category||"";category.maxLength=60;category.setAttribute("aria-label","Photo category");
      const caption=element("textarea");caption.value=photo.caption||"";caption.maxLength=350;caption.rows=2;caption.setAttribute("aria-label","Photo caption");
      card.append(job,category,caption);
      const actions=element("div","ks-admin-actions"),save=element("button","btn","Save changes"),use=element("button","btn outline","Use in news"),del=element("button","btn outline","Remove");
      [save,use,del].forEach(b=>b.type="button");
      const st=element("span","ks-admin-status");actions.append(save,use,del,st);card.append(actions);
      save.onclick=async()=>{save.disabled=true;try{await api("/api/admin/gallery/"+photo.id,"PUT",{job:job.value,category:category.value,caption:caption.value});alertStatus("Photo details saved.",false,st)}catch(e){alertStatus(e.message,true,st)}finally{save.disabled=false}};
      use.onclick=async()=>{tab("news");newsForm.elements.namedItem("image_url").value=photo.src;alertStatus("Image selected for your article. Add a headline and text before publishing.");await loadNews()};
      del.onclick=async()=>{
        if(!confirm("Remove this photo from the public gallery?"))return;
        del.disabled=true;try{await api("/api/admin/gallery/"+photo.id,"DELETE");alertStatus("Photo removed.");await loadPhotos()}
        catch(e){alertStatus(e.message,true,st);del.disabled=false}
      };
      photosList.append(card);
    }
  }catch(e){photosList.replaceChildren(element("p","ks-admin-status error",e.message))}
}
function selectedNews(){
  const map=new Map(newsSeed.map(r=>[r.id,r]));
  for(const a of newsOverrides)map.set(a.id,{...map.get(a.id),...a});
  return Array.from(map.values()).sort((a,b)=>String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at)));
}
function fillNews(a){
  for(const key of ["id","title","category","body","image_url","source_url"]){
    const target=newsForm.elements.namedItem(key);if(target)target.value=a[key]||"";
  }
  newsForm.elements.namedItem("published").checked=a.published!==0&&a.published!==false;
  $("newsFormHeading").textContent="Edit article: "+a.title;
  window.scrollTo({top:0,behavior:"smooth"});
}
function resetNews(){
  newsForm.reset();newsForm.elements.namedItem("id").value="";
  $("newsFormHeading").textContent="Write an article";
}
$("newsReset").addEventListener("click",resetNews);
newsForm.addEventListener("submit",async event=>{
  event.preventDefault();
  const btn=newsForm.querySelector("[type=submit]");btn.disabled=true;
  const data=Object.fromEntries(new FormData(newsForm).entries());
  data.published=newsForm.elements.namedItem("published").checked;
  try{
    await api("/api/admin/news","POST",data);
    alertStatus("Your article has been saved. Published articles appear on the news page.");
    resetNews();await loadNews();
  }catch(e){alertStatus(e.message,true)}finally{btn.disabled=false}
});
async function loadNews(){
  newsList.replaceChildren(element("p","","Loading articles…"));
  try{
    const [seed,remote]=await Promise.all([
      fetch("./news-data.json",{cache:"no-store"}).then(r=>r.ok?r.json():{articles:[]}).catch(()=>({articles:[]})),
      api("/api/admin/news")
    ]);
    newsSeed=seed.articles||[];newsOverrides=remote.articles||[];
    newsList.replaceChildren();
    const list=selectedNews();
    if(!list.length){newsList.append(element("p","ks-admin-muted","Write the first news article above."));return;}
    for(const a of list){
      const card=element("article","ks-admin-card");
      if(a.image_url){const img=element("img","ks-admin-photo");img.src=a.image_url;img.alt=a.title;img.loading="lazy";card.append(img);}
      card.append(element("p","ks-admin-muted",a.category+" · "+(a.published===0?"Unpublished":"Published")));
      card.append(element("h3","",a.title));
      card.append(element("p","",String(a.body||"").slice(0,180)+"…"));
      const actions=element("div","ks-admin-actions"),edit=element("button","btn outline","Edit"),status=element("span","ks-admin-status");
      edit.type="button";edit.onclick=()=>fillNews(a);actions.append(edit);
      if(!newsSeed.some(s=>s.id===a.id)){
        const remove=element("button","btn outline","Delete");
        remove.type="button";remove.onclick=async()=>{
          if(!confirm("Permanently delete this article?"))return;
          try{await api("/api/admin/news/"+a.id,"DELETE");alertStatus("Article removed.");await loadNews()}
          catch(e){alertStatus(e.message,true,status)}
        };actions.append(remove);
      }
      actions.append(status);card.append(actions);newsList.append(card);
    }
  }catch(e){newsList.replaceChildren(element("p","ks-admin-status error",e.message))}
}
window.addEventListener("message",e=>{
  if(e.origin!==location.origin||e.source!==document.getElementById("ksQuoteFrame")?.contentWindow)return;
  if(e.data?.type==="ks-quote-height"&&Number.isFinite(e.data.height)){
    document.getElementById("ksQuoteFrame").style.height=Math.max(750,Math.min(7000,e.data.height+12))+"px";
  }
});
session();
})();