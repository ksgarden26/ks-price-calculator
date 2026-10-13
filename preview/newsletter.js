(() => {
  "use strict";
  const forms=[...document.querySelectorAll("[data-ks-newsletter-form]")];
  const activation=document.querySelectorAll("[data-ks-newsletter-activation]");
  const done=new URLSearchParams(location.search).get("confirmed")==="1";
  if(done){const banner=document.getElementById("ksNewsletterConfirmed");if(banner)banner.hidden=false;}
  if(!forms.length)return;
  const setStatus=(form,message,kind="info")=>{
    const el=form.querySelector("[data-ks-newsletter-status]");
    if(el){el.textContent=message;el.dataset.state=kind;}
  };
  const lock=(form,locked)=>{
    const submit=form.querySelector("button[type=submit]");
    if(submit)submit.disabled=locked;
  };
  // Do not collect an email until the protected server-side mailing integration works.
  for(const form of forms){lock(form,true);setStatus(form,"Checking newsletter availability…");}
  fetch("/api/newsletter/status",{credentials:"same-origin",cache:"no-store"})
    .then(r=>r.ok?r.json():{configured:false}).catch(()=>({configured:false}))
    .then(data=>{
      const ready=data.configured===true;
      for(const form of forms){
        lock(form,!ready);
        setStatus(form,ready?"":"Newsletter signup is being connected — please check back soon.",ready?"info":"unavailable");
      }
      for(const item of activation)item.hidden=ready;
    });
  for(const form of forms){
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      const email=form.elements.namedItem("email").value.trim();
      const consent=form.elements.namedItem("consent").checked;
      const trap=form.elements.namedItem("website").value;
      if(!consent){setStatus(form,"Please tick the box to agree to receive the newsletter.","error");return;}
      if(!email||!form.reportValidity())return;
      lock(form,true);setStatus(form,"Sending your confirmation email…");
      try{
        const r=await fetch("/api/newsletter/subscribe",{
          method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",
          body:JSON.stringify({email,consent,website:trap})
        });
        const data=await r.json().catch(()=>({}));
        if(!r.ok)throw Error(data.error||"Newsletter signup is not available right now.");
        form.reset();
        setStatus(form,"Please check your inbox and confirm your email address. You won't receive the newsletter until you confirm.","success");
      }catch(error){
        setStatus(form,error.message||"Please try again later.","error");
      }finally{lock(form,false);}
    });
  }
})();