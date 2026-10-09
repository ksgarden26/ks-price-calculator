(function(){
"use strict";
var OWNER="ksgarden26", REPO="ks-price-calculator", BRANCH="main";
var ROOT="preview/", DATA=ROOT+"gallery-data.json";
var API="https://api.github.com/repos/"+OWNER+"/"+REPO+"/contents/";
var RAW="https://raw.githubusercontent.com/"+OWNER+"/"+REPO+"/"+BRANCH+"/"+ROOT;
var token="", queued=[], urls=[], busy=false;
function el(id){return document.getElementById(id);}
function showMessage(message,isError){var e=el("message");e.textContent=message;e.className="message"+(isError?" error":"");e.hidden=false;clearTimeout(showMessage.timer);showMessage.timer=setTimeout(function(){e.hidden=true;},8500);}
function setBusy(state){busy=state;document.body.classList.toggle("busy",state);el("uploadBtn").disabled=state||!queued.length;el("connectBtn").disabled=state;}
function safePath(path){return path.split("/").map(encodeURIComponent).join("/");}
function errorMessage(error){if(error.status===401)return "GitHub rejected the token. Generate a fresh fine-grained access token and try again.";if(error.status===403)return "GitHub refused access. Check the token is restricted to this repository with Contents: Read and write permissions.";if(error.status===413)return "Photo too large for GitHub. Try a smaller image.";return error.message||"Something went wrong. Please try again.";}
async function request(method,path,body){
 if(!token)throw Error("Connect to GitHub first.");
 var endpoint=API+safePath(path)+(method==="GET"?"?ref="+BRANCH:"");
 var response=await fetch(endpoint,{method:method,mode:"cors",cache:"no-store",headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 var result=await response.json().catch(function(){return {};});
 if(!response.ok){var error=Error(result.message||("GitHub request failed ("+response.status+")"));error.status=response.status;throw error;}
 return result;
}
function fromBase64(str){return new TextDecoder().decode(Uint8Array.from(atob(str.replace(/\s/g,"")),function(ch){return ch.charCodeAt(0);}));}
function toBase64(str){var bytes=new TextEncoder().encode(str);var s="";for(var i=0;i<bytes.length;i+=8192){s+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));}return btoa(s);}
function blobBase64(blob){return new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(String(reader.result).split(",")[1]);};reader.onerror=reject;reader.readAsDataURL(blob);});}
async function getData(){
 try{var data=await request("GET",DATA);return {sha:data.sha,info:JSON.parse(fromBase64(data.content))};}
 catch(error){if(error.status===404)return {sha:null,info:{version:1,photos:[]}};throw error;}
}
async function updateData(modifier,message){
 for(var tries=0;tries<4;tries++){
  var current=await getData();var info=current.info;if(!Array.isArray(info.photos))info.photos=[];
  modifier(info.photos);info.version=1;info.updated=new Date().toISOString();
  var payload={message:message,content:toBase64(JSON.stringify(info,null,2)+"\n"),branch:BRANCH};if(current.sha)payload.sha=current.sha;
  try{return await request("PUT",DATA,payload);}
  catch(error){if(tries===3||(error.status!==409&&error.status!==422))throw error;}
 }
}
function acceptablePath(path){return typeof path==="string" && /^gallery-images\/[a-zA-Z0-9._/-]+\.jpg$/.test(path)&&!path.includes("..");}
function imageUrl(photo){return RAW+safePath(photo.src);}
async function connect(){
 var value=el("token").value.trim();if(!value){showMessage("Please enter a GitHub token.",true);return;}
 token=value;setBusy(true);el("connectBtn").textContent="Connecting…";
 try{await getData();el("token").value="";el("loginPanel").hidden=true;el("appPanel").hidden=false;el("connection").textContent="● Connected";el("connection").classList.add("online");await refresh();showMessage("Connected to your GitHub gallery.");}
 catch(error){token="";showMessage(errorMessage(error),true);}
 finally{setBusy(false);el("connectBtn").textContent="Connect securely";}
}
function disconnect(){token="";queued=[];clearPreviews();el("appPanel").hidden=true;el("loginPanel").hidden=false;el("connection").textContent="Not connected";el("connection").classList.remove("online");el("photos").value="";el("uploadBtn").disabled=true;showMessage("Disconnected. Your access token has been cleared.");}
function clearPreviews(){urls.forEach(function(url){URL.revokeObjectURL(url);});urls=[];el("previews").replaceChildren();}
function addFiles(files){if(busy)return;var images=Array.from(files).filter(function(f){return f.type.startsWith("image/")||/\.(heic|heif|jpe?g|png|webp)$/i.test(f.name);});queued=queued.concat(images).slice(0,12);renderPreviews();}
function renderPreviews(){
 clearPreviews();queued.forEach(function(file){var tile=document.createElement("div");tile.className="preview-tile";var img=document.createElement("img");var url=URL.createObjectURL(file);urls.push(url);img.src=url;img.alt="Selected: "+file.name;var label=document.createElement("span");label.textContent=file.name;tile.append(img,label);el("previews").append(tile);});
 el("uploadCount").textContent=queued.length?"("+queued.length+")":"";el("uploadBtn").disabled=!queued.length||busy;
}
function slug(input){return String(input||"garden").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,35)||"garden";}
function randomId(){return (crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+"-"+Math.random().toString(36).slice(2));}
function toJpeg(file){
 return new Promise(function(resolve,reject){
  var url=URL.createObjectURL(file),img=new Image();
  img.onload=function(){
   try{var scale=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));var canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));var context=canvas.getContext("2d");if(!context)throw Error("Your phone cannot prepare this photo.");context.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(function(blob){URL.revokeObjectURL(url);if(!blob){reject(Error("Could not convert this photo."));return;}resolve(blob);},"image/jpeg",0.83);}catch(e){URL.revokeObjectURL(url);reject(e);}
  };
  img.onerror=function(){URL.revokeObjectURL(url);reject(Error("Could not open "+file.name+". Try saving it as a JPEG first."));};
  img.src=url;
 });
}
async function upload(){
 if(busy||!queued.length)return;
 var files=queued.slice(),job=el("job").value.trim(),category=el("category").value,caption=el("caption").value.trim();
 setBusy(true);el("progressTrack").hidden=false;el("progressBar").style.width="0%";
 var completed=0,failed=null;
 for(var i=0;i<files.length;i++){
  var file=files[i];el("uploadBtn").textContent="Uploading "+(i+1)+" of "+files.length+"…";
  try{
   var jpg=await toJpeg(file),id=randomId(),path="gallery-images/"+new Date().toISOString().slice(0,10)+"-"+id.slice(0,8)+"-"+slug(job||category)+".jpg";
   if(jpg.size>9*1024*1024)throw Error("This photo is still over 9 MB after resizing. Please choose a smaller picture.");
   await request("PUT",ROOT+path,{message:"Gallery: upload "+(job||category),content:await blobBase64(jpg),branch:BRANCH});
   var item={id:id,src:path,job:job||"Garden work",category:category,caption:caption,date:new Date().toISOString()};
   await updateData(function(photos){if(!photos.some(function(p){return p.id===id;}))photos.unshift(item);},"Gallery: publish "+(job||category));
   completed++;
   el("progressBar").style.width=Math.round(completed/files.length*100)+"%";
  }catch(error){failed=error;break;}
 }
 if(completed){queued=files.slice(completed);renderPreviews();try{await refresh();}catch(e){showMessage("Images uploaded, but could not refresh the gallery: "+errorMessage(e),true);}}
 setBusy(false);el("uploadBtn").textContent="Upload to GitHub";
 if(failed){showMessage(completed+" uploaded. Next photo failed: "+errorMessage(failed),true);}
 else{el("photos").value="";el("job").value="";el("caption").value="";el("progressBar").style.width="100%";showMessage(completed+" photo"+(completed===1?"":"s")+" uploaded to GitHub successfully!");}
}
function entryText(photo){return (photo.job||"Garden work")+(photo.caption?" — "+photo.caption:"");}
async function refresh(){
 var value=await getData(),list=Array.isArray(value.info.photos)?value.info.photos:[];
 list=list.filter(function(photo){return photo&&acceptablePath(photo.src);});
 el("galleryGrid").replaceChildren();el("gallerySummary").textContent=list.length+" uploaded photo"+(list.length===1?"":"s");el("emptyGallery").hidden=list.length!==0;
 list.forEach(function(photo){
  var card=document.createElement("article");card.className="gallery-item";
  var img=document.createElement("img");img.src=imageUrl(photo);img.alt=entryText(photo);img.loading="lazy";
  var info=document.createElement("div");info.className="gallery-info";
  var tag=document.createElement("span");tag.className="tag";tag.textContent=photo.category||"Gallery";
  var title=document.createElement("strong");title.textContent=photo.job||"Garden work";
  var desc=document.createElement("p");desc.textContent=photo.caption||"No description";
  var actions=document.createElement("div");actions.className="item-actions";
  var edit=document.createElement("button");edit.type="button";edit.textContent="Edit";edit.addEventListener("click",function(){editPhoto(photo);});
  var del=document.createElement("button");del.type="button";del.className="danger";del.textContent="Remove";del.addEventListener("click",function(){removePhoto(photo);});
  actions.append(edit,del);info.append(tag,title,desc,actions);card.append(img,info);el("galleryGrid").append(card);
 });
}
async function editPhoto(photo){
 if(busy)return;var title=prompt("Job or project title:",photo.job||"");if(title===null)return;var caption=prompt("Photo description:",photo.caption||"");if(caption===null)return;setBusy(true);
 try{await updateData(function(photos){var target=photos.find(function(p){return p.id===photo.id;});if(target){target.job=title.trim().slice(0,100)||"Garden work";target.caption=caption.trim().slice(0,180);}},"Gallery: edit photo details");await refresh();showMessage("Photo details updated.");}
 catch(error){showMessage(errorMessage(error),true);}finally{setBusy(false);}
}
async function removePhoto(photo){
 if(busy||!confirm("Remove this photo from the website and GitHub? It may remain in Git history even after deletion."))return;
 setBusy(true);
 try{
  try{var file=await request("GET",ROOT+photo.src);await request("DELETE",ROOT+photo.src,{message:"Gallery: remove photo",sha:file.sha,branch:BRANCH});}catch(error){if(error.status!==404)throw error;}
  await updateData(function(photos){var n=photos.findIndex(function(p){return p.id===photo.id;});if(n!==-1)photos.splice(n,1);},"Gallery: remove photo from index");
  await refresh();showMessage("Photo removed from gallery.");
 }catch(error){showMessage("Could not fully remove photo: "+errorMessage(error),true);}finally{setBusy(false);}
}
document.addEventListener("DOMContentLoaded",function(){
 el("connectForm").addEventListener("submit",function(e){e.preventDefault();connect();});
 el("disconnectBtn").addEventListener("click",disconnect);
 el("refreshBtn").addEventListener("click",async function(){try{await refresh();showMessage("Gallery refreshed.");}catch(e){showMessage(errorMessage(e),true);}});
 el("photos").addEventListener("change",function(e){addFiles(e.target.files);e.target.value="";});
 el("camera").addEventListener("change",function(e){addFiles(e.target.files);e.target.value="";});
 el("uploadForm").addEventListener("submit",function(e){e.preventDefault();upload();});
 if("serviceWorker" in navigator && location.protocol==="https:"){navigator.serviceWorker.register("./sw.js").catch(function(){});}
});
})();