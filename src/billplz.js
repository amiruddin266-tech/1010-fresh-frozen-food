import crypto from 'node:crypto';

export function verifyXSignature(body){
 const key=process.env.BILLPLZ_X_SIGNATURE_KEY;
 if(!key) throw new Error('BILLPLZ_X_SIGNATURE_KEY is not configured');
 const received=String(body.x_signature||'');
 if(!received) return false;
 const source=Object.entries(body).filter(([k])=>k!=='x_signature').map(([k,v])=>`${k}${v??''}`).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'})).join('|');
 const expected=crypto.createHmac('sha256',key).update(source).digest('hex');
 return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(received));
}
export async function createBill({name,email,mobile,amountCents,description,reference}){
 const endpoint=`${process.env.BILLPLZ_API_URL||'https://www.billplz.com/api'}/v3/bills`;
 const params=new URLSearchParams({collection_id:process.env.BILLPLZ_COLLECTION_ID,name,email,mobile,amount:String(amountCents),description,callback_url:process.env.BILLPLZ_CALLBACK_URL,redirect_url:process.env.BILLPLZ_REDIRECT_URL,reference_1_label:'Order',reference_1:reference});
 const auth=Buffer.from(`${process.env.BILLPLZ_SECRET_KEY}:`).toString('base64');
 const r=await fetch(endpoint,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body:params});
 const data=await r.json();
 if(!r.ok) throw new Error(`Billplz ${r.status}: ${JSON.stringify(data)}`);
 return data;
}
