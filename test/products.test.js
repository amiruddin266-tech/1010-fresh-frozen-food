import test from 'node:test';import assert from 'node:assert/strict';import {PRODUCTS,SIZE_RANGES} from '../src/products.js';
test('five products and five sizes exist',()=>{assert.equal(PRODUCTS.length,5);for(const p of PRODUCTS)assert.deepEqual(Object.keys(p.prices),Object.keys(SIZE_RANGES));});
