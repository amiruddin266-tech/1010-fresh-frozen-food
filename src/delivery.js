const PICKUP_LOCATIONS = {
  kuala_terengganu: 'Near SMK Sri Nilam, Kuala Terengganu',
  kuala_berang: 'Kampung Langgar, Kuala Berang'
};

const DELIVERY_ZONES = [
  {maxKm:10, zone:'0-10km', standardFee:3, largeOrderFee:0},
  {maxKm:20, zone:'10-20km', standardFee:7, largeOrderFee:3},
  {maxKm:30, zone:'20-30km', standardFee:12, largeOrderFee:7},
  {maxKm:40, zone:'30-40km', standardFee:17, largeOrderFee:12}
];

export function calculateDeliveryFee({subtotal, distanceKm, deliveryMethod, pickupLocation}) {
  if (!Number.isFinite(subtotal) || subtotal < 0) throw new Error('Invalid subtotal');
  if (deliveryMethod === 'pickup') {
    if (!Object.hasOwn(PICKUP_LOCATIONS, pickupLocation)) throw new Error('Invalid pickup location');
    return {deliveryFee:0, deliveryZone:'pickup', isFree:true, message:'FREE PICKUP'};
  }
  if (deliveryMethod !== 'delivery' || !Number.isFinite(distanceKm) || distanceKm < 0) throw new Error('Invalid delivery details');
  const distance = Math.round(distanceKm * 10) / 10;
  const zone = DELIVERY_ZONES.find(item => distance <= item.maxKm);
  if (!zone) return {deliveryFee:null, deliveryZone:'over-40km', isFree:false, message:'Delivery unavailable. Please contact us.'};
  const isFree = subtotal >= 150 && zone.largeOrderFee === 0;
  const deliveryFee = subtotal >= 150 ? zone.largeOrderFee : zone.standardFee;
  return {
    deliveryFee,
    deliveryZone:zone.zone,
    isFree,
    message:isFree ? 'Free delivery for orders RM150 and above' : `Delivery fee RM${deliveryFee}`
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {headers:{'User-Agent':'1010-fresh-frozen-food/1.0 contact-owner'}});
  if (!response.ok) throw new Error(`Distance service returned ${response.status}`);
  return response.json();
}

async function geocode(address) {
  const endpoint = process.env.GEOCODING_API_URL || 'https://nominatim.openstreetmap.org/search';
  const params = new URLSearchParams({q:address,format:'jsonv2',limit:'1',countrycodes:'my'});
  const results = await fetchJson(`${endpoint}?${params}`);
  if (!results[0]) throw new Error('Address could not be located');
  return {latitude:Number(results[0].lat), longitude:Number(results[0].lon)};
}

async function geocodePostcode(postcode) {
  if (!/^\d{5}$/.test(postcode)) throw new Error('Please enter a valid 5-digit postcode');
  return geocode(`${postcode}, Malaysia`);
}

async function routeDistanceKm(origin, destination) {
  const endpoint = process.env.ROUTING_API_URL || 'https://router.project-osrm.org/route/v1/driving';
  const url = `${endpoint}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=false`;
  const data = await fetchJson(url);
  if (!data.routes?.[0]?.distance) throw new Error('Road route unavailable');
  return data.routes[0].distance / 1000;
}

export async function calculateRoadDistance({address, postcode}) {
  if (typeof address !== 'string' || address.trim().length < 5) throw new Error('Please enter a valid delivery address');
  let destination;
  try {
    destination = await geocodePostcode(postcode);
  } catch {
    destination = await geocode(address);
  }
  const originAddresses = [
    process.env.DELIVERY_ORIGIN_KUALA_TERENGGANU || 'Sri Nilam, Kuala Terengganu, Malaysia',
    process.env.DELIVERY_ORIGIN_KUALA_BERANG || 'Kampung Langgar, Kuala Berang, Terengganu, Malaysia'
  ];
  const origins = await Promise.all(originAddresses.map(geocode));
  const distances = await Promise.all(origins.map(origin => routeDistanceKm(origin, destination)));
  return Math.round(Math.min(...distances) * 10) / 10;
}

export function getPickupLocations() { return PICKUP_LOCATIONS; }
