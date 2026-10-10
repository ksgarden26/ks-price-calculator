(() => {
  "use strict";
  const list=document.getElementById("ksNewsArticles");
  if(!list)return;
  const node=(tag,cls,content)=>{
    const el=document.createElement(tag);if(cls)el.className=cls;
    if(content!==undefined)el.textContent=String(content);
    return el;
  };
  const safeImage=url=>typeof url==="string" && (/^https:\/\//i.test(url)||/^\.\.\/[a-zA-Z0-9_./%,-]+$/.test(url)||/^\/api\/media\/[a-f0-9-]+\.jpg$/.test(url));
  function render(seed,remote){
    const all=new Map((Array.isArray(seed)?seed:[]).map(a=>[a.id,a]));
    for(const a of (Array.isArray(remote)?remote:[]))all.set(a.id,{...all.get(a.id),...a});
    const articles=[...all.values()].filter(a=>a.published!==0&&a.published!==false&&a.title&&a.body);
    articles.sort((a,b)=>String(b.created_at||b.updated_at).localeCompare(String(a.created_at||a.updated_at)));
    list.replaceChildren();
    if(!articles.length){list.append(node("p","ks-news-empty","New garden news and seasonal advice will appear here soon."));return;}
    for(const a of articles){
      const card=node("article","ks-editable-news-card");
      if(safeImage(a.image_url)){
        const photo=node("img","ks-editable-news-image");photo.src=a.image_url;
        photo.alt=a.title;photo.loading="lazy";photo.decoding="async";card.append(photo);
      }
      const body=node("div","ks-editable-news-body");
      const date=new Date(a.created_at);
      const d=Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"long",year:"numeric"}).format(date);
      body.append(node("p","ks-editable-news-kicker",[d,a.category].filter(Boolean).join(" · ")));
      body.append(node("h2","",a.title));
      for(const para of String(a.body).split(/\n\s*\n/).filter(Boolean)){
        body.append(node("p","ks-editable-news-text",para));
      }
      if(typeof a.source_url==="string"&&/^https:\/\//i.test(a.source_url)){
        const link=node("a","ks-editable-news-source","Read the original source ↗");
        link.href=a.source_url;link.target="_blank";link.rel="noopener noreferrer";
        body.append(link);
      }
      card.append(body);list.append(card);
    }
  }
  Promise.all([
    fetch("./news-data.json",{cache:"no-store"}).then(r=>r.ok?r.json():{articles:[]}).catch(()=>({articles:[]})),
    fetch("/api/news",{cache:"no-store"}).then(r=>r.ok?r.json():{articles:[]}).catch(()=>({articles:[]}))
  ]).then(([seed,dynamic])=>render(seed.articles,dynamic.articles))
  .catch(()=>{list.replaceChildren(node("p","ks-news-empty","Garden news is temporarily unavailable."));});
})();