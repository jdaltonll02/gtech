import sharp from 'sharp';

const [challengeId,code]=process.argv.slice(2);
if(!challengeId||!code) throw new Error('Usage: node scripts/media-smoke.mjs <challenge-id> <otp-code>');
const api='http://localhost:8000/api/v1';
const call=async(path,options={})=>{const response=await fetch(`${api}${path}`,options);if(!response.ok)throw new Error(`${response.status} ${await response.text()}`);return response.status===204?null:response.json();};
const tokens=await call('/auth/otp/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({challenge_id:challengeId,code})});
const auth={authorization:`Bearer ${tokens.access}`,'content-type':'application/json'};
const image=await sharp({create:{width:1200,height:800,channels:3,background:'#e0102d'}}).jpeg().withExif({IFD3:{GPSLatitudeRef:'N',GPSLatitude:'6/1 18/1 0/1',GPSLongitudeRef:'W',GPSLongitude:'10/1 48/1 0/1'}}).toBuffer();
const signed=await call('/media/photos/upload-url',{method:'POST',headers:auth,body:JSON.stringify({content_type:'image/jpeg',content_length:image.length})});
const upload=await fetch(signed.upload_url,{method:'PUT',headers:signed.required_headers,body:image});
if(!upload.ok) throw new Error(`Upload failed: ${upload.status} ${await upload.text()}`);
const photo=await call('/media/photos',{method:'POST',headers:auth,body:JSON.stringify({key:signed.key,position:0})});
console.log(JSON.stringify({photo_id:photo.id,key:signed.key},null,2));
