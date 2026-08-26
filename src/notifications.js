import nodemailer from 'nodemailer';

function money(cents){return `RM ${(cents/100).toFixed(2)}`;}
function itemText(order){return order.items.map(i=>`${i.product_name} (${i.size}, ${i.weight_range}) × ${i.quantity} — ${money(i.line_total_cents)}`).join('\n');}

export async function sendEmail(order){
 if(!process.env.SMTP_HOST || !process.env.SMTP_USER) return;
 const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE)==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
 const text=`Order ${order.order_no}\nCustomer: ${order.customer_name}\nPhone: ${order.phone}\nEmail: ${order.email}\nAddress: ${order.address}, ${order.postcode} ${order.city}, ${order.state}\n\nItems:\n${itemText(order)}\n\nTotal: ${money(order.total_cents)}\nPayment: ${order.payment_status}`;
 await transporter.sendMail({from:process.env.SMTP_FROM,to:order.email,subject:`1010 Fresh Frozen Food — Order ${order.order_no}`,text});
 if(process.env.OWNER_EMAIL) await transporter.sendMail({from:process.env.SMTP_FROM,to:process.env.OWNER_EMAIL,subject:`NEW ORDER ${order.order_no} — ${money(order.total_cents)}`,text});
}

async function sendWhatsApp(to, order){
 if(!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN || !to) return;
 const url=`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION||'v23.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
 const body={messaging_product:'whatsapp',to:String(to).replace(/\D/g,''),type:'template',template:{name:process.env.WHATSAPP_TEMPLATE_NAME||'order_confirmation',language:{code:process.env.WHATSAPP_TEMPLATE_LANGUAGE||'en'},components:[{type:'body',parameters:[{type:'text',text:order.order_no},{type:'text',text:order.customer_name},{type:'text',text:money(order.total_cents)},{type:'text',text:order.payment_status}]}]}};
 const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok) throw new Error(`WhatsApp API ${r.status}: ${await r.text()}`);
}
export async function sendNotifications(order){
 await Promise.allSettled([sendEmail(order),sendWhatsApp(order.phone,order),sendWhatsApp(process.env.OWNER_WHATSAPP,order)]);
}
