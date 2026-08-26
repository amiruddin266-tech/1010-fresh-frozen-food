import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import QRCode from 'qrcode';
import {z} from 'zod';
import {PRODUCTS,SIZE_RANGES,getProduct} from './products.js';
import {createOrder,getOrderById,getOrderByNo,setBill,markPaid,markNotificationSent,listOrders} from './db.js';
import {createBill,verifyXSignature} from './billplz.js';
import {sendNotifications} from './notifications.js';
import {calculateDeliveryFee,calculateRoadDistance,getPickupLocations} from './delivery.js';

const app=express();
app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}));
app.use(compression());
app.use(express.urlencoded({extended:true}));
app.use(express.json({limit:'100kb'}));
app.use(rateLimit({windowMs:15*60*1000,limit:300,standardHeaders:true,legacyHeaders:false}));
app.use(express.static('public',{maxAge:'1h'}));

app.get('/api/products',(req,res)=>res.json({products:PRODUCTS.map(p=>({...p,sizeRanges:SIZE_RANGES}))}));
const itemSchema=z.object({productId:z.string(),size:z.enum(['S','M','M2','L','L2','XL']),quantity:z.number().int().min(1).max(20)});
const checkoutSchema=z.object({customerName:z.string().trim().min(2).max(100).optional(),email:z.string().trim().email().max(254).optional(),phone:z.string().trim().regex(/^\+?60\d{8,11}$/,'Use a Malaysian phone number, e.g. +60123456789').optional(),address:z.string().trim().max(500).optional(),city:z.string().trim().max(80).optional(),postcode:z.string().trim().regex(/^\d{5}$/).or(z.literal('')).optional(),state:z.string().trim().max(50).optional(),notes:z.string().trim().max(500).optional(),deliveryMethod:z.enum(['pickup','delivery']),pickupLocation:z.enum(['kuala_terengganu','kuala_berang']).optional(),items:z.array(itemSchema).min(1).max(30)});
function getItemsAndSubtotal(items){
 const pricedItems=[]; let subtotalCents=0;
 for(const line of items){const p=getProduct(line.productId);if(!p)throw new Error('Invalid product');const unitPriceCents=p.prices[line.size]*100;const lineTotalCents=unitPriceCents*line.quantity;subtotalCents+=lineTotalCents;pricedItems.push({productId:p.id,productName:p.name,size:line.size,weightRange:SIZE_RANGES[line.size],quantity:line.quantity,unitPriceCents,lineTotalCents});}
 return {pricedItems,subtotalCents};
}
async function calculatePricing(input){
 const {pricedItems,subtotalCents}=getItemsAndSubtotal(input.items);let distanceKm=null;let address=input.address||'';
 if(input.deliveryMethod==='pickup'){const locations=getPickupLocations();if(!input.pickupLocation)throw new Error('Please select a pickup point');address=locations[input.pickupLocation];}
 else {if(!input.address||!input.city||!input.postcode||!input.state)throw new Error('Please complete your delivery address');try{distanceKm=await calculateRoadDistance({address:`${input.address}, ${input.city}, ${input.state}, Malaysia`,postcode:input.postcode});}catch{throw new Error("We couldn't calculate your delivery fee. Please contact us.");}}
 const fee=calculateDeliveryFee({subtotal:subtotalCents/100,distanceKm,deliveryMethod:input.deliveryMethod,pickupLocation:input.pickupLocation});
 if(fee.deliveryFee===null)throw new Error(fee.message);
 return {pricedItems,subtotalCents,distanceKm,deliveryFeeCents:fee.deliveryFee*100,totalCents:subtotalCents+fee.deliveryFee*100,deliveryZone:fee.deliveryZone,isFree:fee.isFree,message:fee.message,address};
}

app.post('/api/delivery/quote',async(req,res)=>{try{const input=checkoutSchema.pick({deliveryMethod:true,pickupLocation:true,address:true,city:true,postcode:true,state:true,items:true}).parse(req.body);const pricing=await calculatePricing(input);res.json({subtotalCents:pricing.subtotalCents,deliveryFeeCents:pricing.deliveryFeeCents,totalCents:pricing.totalCents,distanceKm:pricing.distanceKm,deliveryZone:pricing.deliveryZone,isFree:pricing.isFree,message:pricing.message});}catch(e){res.status(400).json({error:e.message||'We could not calculate your delivery fee.'});}});

app.post('/api/orders',async(req,res)=>{
 try{
    const input=checkoutSchema.parse(req.body);if(!input.customerName||!input.email||!input.phone)throw new Error('Please complete your customer details');const pricing=await calculatePricing(input);
    const order=createOrder({...input,address:pricing.address,city:input.city||'Pickup',postcode:input.postcode||'00000',state:input.state||'Terengganu',subtotalCents:pricing.subtotalCents,deliveryMethod:input.deliveryMethod,pickupLocation:input.deliveryMethod==='pickup'?input.pickupLocation:null,distanceKm:pricing.distanceKm,deliveryFeeCents:pricing.deliveryFeeCents,totalCents:pricing.totalCents},pricing.pricedItems);
  if(!process.env.BILLPLZ_SECRET_KEY||!process.env.BILLPLZ_COLLECTION_ID) throw new Error('Payment gateway is not configured.');
  const bill=await createBill({name:order.customer_name,email:order.email,mobile:order.phone,amountCents:order.total_cents,description:`1010 Fresh Frozen Food ${order.order_no}`,reference:order.order_no});
  setBill(order.id,bill.id,bill.url);
  const qrData=await QRCode.toDataURL(bill.url,{width:360,margin:2,errorCorrectionLevel:'M'});
  res.status(201).json({orderNo:order.order_no,paymentUrl:bill.url,qrData});
 }catch(e){console.error(e);res.status(e.name==='ZodError'?400:500).json({error:e.name==='ZodError'?'Please check your order details.':e.message||'Unable to create order.'});}
});

app.post('/api/payments/billplz/callback',async(req,res)=>{
 try{
  if(!verifyXSignature(req.body)) return res.status(403).send('Invalid signature');
  const billId=req.body.id; if(String(req.body.paid)!=='true') return res.status(200).send('OK');
  const orderBefore=getOrderByNo(req.body.reference_1||'');
  let order=markPaid(billId,req.body.paid_at);
  if(!order && orderBefore) order=markPaid(billId,req.body.paid_at);
  if(order && !order.notification_sent){try{await sendNotifications(order);markNotificationSent(order.id);}catch(e){console.error('Notification error',e);}}
  return res.status(200).send('OK');
 }catch(e){console.error(e);return res.status(500).send('Callback error');}
});

app.get('/api/orders/:orderNo',(req,res)=>{const o=getOrderByNo(req.params.orderNo);if(!o)return res.status(404).json({error:'Not found'});res.json({orderNo:o.order_no,paymentStatus:o.payment_status,totalCents:o.total_cents,items:o.items});});

function adminAuth(req,res,next){const h=req.headers.authorization||'';const [scheme,encoded]=h.split(' ');if(scheme!=='Basic'||!encoded)return res.set('WWW-Authenticate','Basic realm="1010 Admin"').status(401).send('Authentication required');const [u,p]=Buffer.from(encoded,'base64').toString().split(':');if(u!==process.env.ADMIN_USER||p!==process.env.ADMIN_PASSWORD)return res.set('WWW-Authenticate','Basic realm="1010 Admin"').status(401).send('Invalid credentials');next();}
app.get('/admin/orders',adminAuth,(req,res)=>{res.json({orders:listOrders(200)});});
app.get('/admin',adminAuth,(req,res)=>res.sendFile('admin.html',{root:'public'}));

app.get('/payment-result',(req,res)=>res.sendFile('payment-result.html',{root:'public'}));
app.get('/robots.txt',(req,res)=>res.type('text').send(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${process.env.SITE_URL||'https://your-domain.com'}/sitemap.xml`));
app.get('/sitemap.xml',(req,res)=>res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${process.env.SITE_URL||'https://your-domain.com'}/</loc></url></urlset>`));
app.get('/{*splat}',(req,res)=>res.sendFile('index.html',{root:'public'}));

const port=Number(process.env.PORT||3000);app.listen(port,()=>console.log(`1010 Fresh Frozen Food running on :${port}`));
