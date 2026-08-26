export const SIZE_RANGES = {
  S: '400g–500g',
  M: '550g–650g',
  L: '700g–800g',
  XL: '850g–950g',
  XXL: '1kg–1.2kg'
};

// SAMPLE prices. Replace these before launch.
export const PRODUCTS = [
  { id:'ayam-kampung', name:'Ayam Kampung', description:'Whole frozen free-range style chicken.', prices:{S:18,M:21,L:24,XL:27,XXL:31} },
  { id:'ayam-kampung-berempah', name:'Ayam Kampung Berempah', description:'Whole chicken prepared with a fragrant spice blend.', prices:{S:20,M:23,L:26,XL:29,XXL:33} },
  { id:'ayam-dara', name:'Ayam Dara', description:'Tender whole frozen chicken.', prices:{S:17,M:20,L:23,XL:26,XXL:30} },
  { id:'ayam-teruna', name:'Ayam Teruna', description:'Whole frozen chicken with a hearty portion size.', prices:{S:18,M:21,L:24,XL:27,XXL:31} },
  { id:'ayam-bapuk', name:'Ayam Bapuk', description:'Whole frozen chicken for everyday cooking.', prices:{S:19,M:22, L:25, XL:28, XXL:32} }
];

export function getProduct(id){ return PRODUCTS.find(p=>p.id===id); }
