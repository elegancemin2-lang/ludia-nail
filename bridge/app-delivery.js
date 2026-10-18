export const APP_URL='https://ludianail.vercel.app/';
const isApp=url=>{try{const u=new URL(url);return u.origin===new URL(APP_URL).origin&&u.pathname==='/'&&!u.username&&!u.password;}catch{return false;}};
export async function localApp(context,{open=true}={}){
  let page=context.pages().find(p=>!p.isClosed()&&isApp(p.url()));
  if(!page&&open){page=await context.newPage();await page.goto(APP_URL,{waitUntil:'domcontentloaded'});}
  return page||null;
}
export async function deliverToApp(context,payload){
  const page=await localApp(context);
  await page.waitForFunction(()=>window.LudiaNaverImport?.ready===true&&Boolean(window.LudiaNaverLocalUI?.receiveBridge),null,{timeout:20000});
  if(!isApp(page.url()))throw Error('local_app_changed');
  const result=await page.evaluate(async data=>{
    if(location.origin!=='https://ludianail.vercel.app'||location.pathname!=='/')throw Error('local_app_changed');
    return window.LudiaNaverLocalUI.receiveBridge(data);
  },payload);
  if(!result?.ok||result.persisted!==true)throw Error('local_app_not_acknowledged');
  return result;
}
export async function notifyApp(context,status){
  const page=await localApp(context,{open:false});
  if(page)await page.evaluate(value=>{if(location.origin==='https://ludianail.vercel.app'&&location.pathname==='/')window.LudiaNaverLocalUI?.bridgeStatus(value);},status);
}
