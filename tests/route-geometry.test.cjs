const test=require('node:test');
const assert=require('node:assert/strict');
const g=require('../assets/route-geometry.js');
const path=[{lat:24,lng:121},{lat:24.003,lng:121.004},{lat:24.006,lng:121.002},{lat:24.009,lng:121.006}];
test('slices follow bends and interpolate endpoints without shortcuts',()=>{
  const m=g.measure(path),s=g.slice(m,50,m.total-50);
  assert.deepEqual(s.slice(1,-1),path.slice(1,-1));
  assert(Math.abs(g.measure(s).total-(m.total-100))<1);
  assert.deepEqual(g.slice(m,m.total-50,50),s);
});
test('mileage interpolation follows the road in either travel direction',()=>{
  const p=[{lat:24,lng:121},{lat:24.004,lng:121},{lat:24.009,lng:121}];
  const spec={from:10.2,to:10.7,anchors:[[10,24,121],[11,24.009,121]]};
  const s=g.mileageSlice(p,spec),r=g.mileageSlice([...p].reverse(),spec);
  assert(s.length>=2);assert(Math.abs(g.measure(s).total-501)<5);
  assert.deepEqual(r,[...s].reverse());
});
test('rejects unmatched markers and long closure detours',()=>{
  assert.deepEqual(g.mileageSlice(path,{from:0,to:1,anchors:[[0,25,122],[1,25.01,122]]}),[]);
  const detour=[{lat:24,lng:121},{lat:24.1,lng:121.1},{lat:24.009,lng:121}];
  assert.deepEqual(g.mileageSlice(detour,{from:0,to:1,anchors:[[0,24,121],[1,24.009,121]]}),[]);
});
test('point worksites show only a short vicinity and empty paths stay empty',()=>{
  const p=[{lat:24,lng:121},{lat:24.009,lng:121}];
  const s=g.mileageSlice(p,{from:.4,to:.4,anchors:[[0,24,121],[1,24.009,121]]});
  assert(Math.abs(g.measure(s).total-160)<1);
  assert.deepEqual(g.mileageSlice([],{from:0,to:1,anchors:[]}),[]);
});
