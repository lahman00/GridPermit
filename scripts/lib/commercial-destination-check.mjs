// Read-only protocol checker. No browser, JavaScript, forms, cookies or analytics.
// Live callers provide exact approved hosts and must not send synthetic CIDs.
export async function checkCommercialDestination(url,{expectedHosts,fetchImpl=globalThis.fetch,maxRedirects=5,timeoutMs=7000}={}){
  const chain=[];
  const allowed=value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&expectedHosts?.includes(u.hostname)&&/^[a-z0-9.-]+\.[a-z]{2,}$/.test(u.hostname)&&!/(^|\.)(localhost|local|internal|invalid)$/.test(u.hostname);};
  let current=url;
  try{
    const initial=new URL(url),required=[...initial.searchParams];
    for(let i=0;i<=maxRedirects;i++){
      if(!allowed(current))throw new Error('UNAPPROVED_REDIRECT_HOST');
      if(chain.some(h=>h.url===current))throw new Error('REDIRECT_LOOP');
      const response=await fetchImpl(current,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(timeoutMs),headers:{'User-Agent':'GridPermit-ReadOnly-Contract-Audit/1.0'}});
      chain.push({url:current,status:response.status});
      if([301,302,303,307,308].includes(response.status)){
        const location=response.headers.get('location');if(!location)throw new Error('REDIRECT_WITHOUT_LOCATION');
        current=new URL(location,current).href;continue;
      }
      const final=new URL(current),queryPreserved=required.length?required.every(([k,v])=>final.searchParams.get(k)===v):null;
      return {url,ok:response.status===200&&queryPreserved!==false,status:response.status,finalUrl:current,checkedAt:new Date().toISOString(),queryPreserved,chain,reason:queryPreserved===false?'QUERY_DROPPED':response.status===200?'OK':'NON_200'};
    }
    throw new Error('TOO_MANY_REDIRECTS');
  }catch(error){return {url,ok:false,status:null,finalUrl:null,checkedAt:new Date().toISOString(),queryPreserved:null,chain,reason:error.message};}
}
