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

const app=express();
app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}));
app.use(compression());
app.use(express.urlencoded({extended:true}));
app.use(express.json({limit:'100kb'}));
app.use(rateLimit({windowMs:15*60*1000,limit:300,standardHeaders:true,legacyHeaders:false}));
app.use(express.static('public',{maxAge:'1h'}));

app.get('/api/products',(req,res)=>res.json({products:PRODUCTS.map(p=>({...p,sizeRanges:SIZE_RANGES}))}));
const checkoutSchema=z.object({customerName:z.string().trim().min(2).max(100),email:z.string().trim().email().max(254),phone:z.string().trim().regex(/^\+?60\d{8,11}$/,'Use a Malaysian phone number, e.g. +60123456789'),address:z.string().trim().min(5).max(500),city:z.string().trim().min(2).max(80),postcode:z.string().trim().regex(/^\d{5}$/),state:z.string().trim().min(2).max(50),notes:z.string().trim().max(500).optional(),items:z.array(z.object({productId:z.string(),size:z.enum(['S','M','L','XL','XXL']),quantity:z.number().int().min(1).max(20)})).min(1).max(30)});

app.post('/api/orders',async(req,res)=>{
 try{
  const input=checkoutSchema.parse(req.body); const items=[]; let total=0;
  for(const line of input.items){const p=getProduct(line.productId); if(!p) throw new Error('Invalid product'); const unit=p.prices[line.size]*100; const lineTotal=unit*line.quantity; total+=lineTotal; items.push({productId:p.id,productName:p.name,size:line.size,weightRange:SIZE_RANGES[line.size],quantity:line.quantity,unitPriceCents:unit,lineTotalCents:lineTotal});}
  const order=createOrder({...input,totalCents:total},items);
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
