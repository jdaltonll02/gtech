const accessKey='pepper.access';const refreshKey='pepper.refresh';
export const tokenStore={access:()=>sessionStorage.getItem(accessKey),refresh:()=>sessionStorage.getItem(refreshKey),write:(access:string,refresh:string)=>{sessionStorage.setItem(accessKey,access);sessionStorage.setItem(refreshKey,refresh)},clear:()=>{sessionStorage.removeItem(accessKey);sessionStorage.removeItem(refreshKey)}};
