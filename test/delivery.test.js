import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateDeliveryFee} from '../src/delivery.js';

const fee = (subtotal, distanceKm) => calculateDeliveryFee({subtotal, distanceKm, deliveryMethod:'delivery'}).deliveryFee;

test('delivery fee scenarios', () => {
  assert.equal(fee(100, 5), 3);
  assert.equal(fee(150, 5), 0);
  assert.equal(fee(150, 15), 3);
  assert.equal(fee(100, 15), 7);
  assert.equal(fee(150, 25), 7);
  assert.equal(fee(100, 25), 12);
  assert.equal(fee(150, 35), 12);
  assert.equal(fee(100, 35), 17);
  assert.equal(calculateDeliveryFee({subtotal:200, deliveryMethod:'pickup', pickupLocation:'kuala_terengganu'}).deliveryFee, 0);
  assert.equal(calculateDeliveryFee({subtotal:50, deliveryMethod:'pickup', pickupLocation:'kuala_berang'}).deliveryFee, 0);
  assert.equal(calculateDeliveryFee({subtotal:100, distanceKm:45, deliveryMethod:'delivery'}).message, 'Delivery unavailable. Please contact us.');
});

test('delivery fees cannot be negative and pickup locations are validated', () => {
  assert.throws(() => calculateDeliveryFee({subtotal:-1, distanceKm:5, deliveryMethod:'delivery'}));
  assert.throws(() => calculateDeliveryFee({subtotal:50, deliveryMethod:'pickup', pickupLocation:'unknown'}));
});
