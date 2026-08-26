export const SIZE_RANGES = {
  S: '1.0–1.1 kg',
  M: '1.1–1.2 kg',
  M2: '1.3–1.4 kg',
  L: '1.5–1.6 kg',
  L2: '1.7–1.8 kg',
  XL: '1.9–2.0 kg'
};

// SAMPLE prices. Replace these before launch.
export const PRODUCTS = [
  { id:'ayam-kampung', name:'Ayam Kampung Asli', image:'/images/products/ayam-asli.jpg', description:'Whole frozen original kampung chicken.', prices:{S:18,M:21,M2:24,L:27,L2:31,XL:35} },
  { id:'ayam-kampung-berempah', name:'Ayam Kampung Berempah', image:'/images/products/ayam-berempah.jpg', description:'Whole chicken prepared with a fragrant spice blend.', prices:{S:20,M:23,M2:26,L:29,L2:33,XL:35} },
  { id:'ayam-perap', name:'Ayam Kampung Perap (Rosemary)', image:'/images/products/ayam-perap.jpg', description:'Whole chicken prepared with rosemary.', prices:{S:17,M:20,M2:23,L:26,L2:30,XL:33} },
  { id:'ayam-kacuk', name:'Ayam Kampung Kacuk', image:'/images/products/ayam-kacuk.jpg', description:'Whole frozen cross-breed kampung chicken.', prices:{S:18,M:21,M2:24,L:27,L2:31,XL:35} },
  { id:'ayam-saga', name:'Ayam Kampung Saga', image:'/images/products/ayam-saga.jpg', description:'Whole frozen Saga kampung chicken.', prices:{S:19,M:22,M2:25,L:28,L2:32,XL:35} }
];

export function getProduct(id){ return PRODUCTS.find(p=>p.id===id); }
