const test=require('node:test');
const assert=require('node:assert/strict');
const client=require('../assets/open-route-client.js');
test('requests use scooter access and retain waypoint order without any Google key',()=>{
 const points=[[24,121],[24.1,121.1],[24.2,121.2]];
 const r=client.request(points);
 assert.equal(r.costing,'motor_scooter');assert.equal(r.shape_format,'polyline6');
 assert.equal(r.costing_options.motor_scooter.exclude_highways,true);
 assert.deepEqual(r.locations.map(p=>[p.lat,p.lon]),points);
 assert.equal(r.locations[1].type,'through');assert(!JSON.stringify(r).includes('key'));
});
test('long itineraries split into overlapping batches, with no missing or reordered points',()=>{
 const nodes=Array.from({length:35},(_,i)=>[24+i/1000,121]);
 const parts=client.chunks(nodes);
 assert.deepEqual(parts.map(p=>p.length),[10,10,10,8]);
 assert.deepEqual(parts[0].at(-1),parts[1][0]);
 assert.deepEqual(parts[1].at(-1),parts[2][0]);
 assert.deepEqual([...parts[0],...parts[1].slice(1),...parts[2].slice(1),...parts[3].slice(1)],nodes);
});
test('parses GeoJSON geometry and rejects errors, missing shapes and invalid coordinates',()=>{
 const response={trip:{status:0,legs:[{shape:{type:'LineString',coordinates:[[121,24],[121.01,24.01],[121.02,24]]},summary:{length:3,time:100}}]}};
 assert.equal(client.parse(response)[0].path.length,3);
 assert.throws(()=>client.parse({trip:{status:400,legs:[]}}));
 assert.throws(()=>client.parse({trip:{status:0,legs:[{shape:'unrecognized-encoding'}]}}));
 assert.throws(()=>client.parse({trip:{status:0,legs:[{shape:{type:'LineString',coordinates:[[121,24],[0,0]]}}]}}));
});
test('decodes the production Valhalla response even when geojson was requested',()=>{
 const response=require('./fixtures/valhalla-day1-polyline6.json');
 assert.equal(typeof response.trip.legs[0].shape,'string');
 const part=client.parse(response)[0];
 assert.equal(part.path.length,11890);
 assert.equal(part.distance,255.119);
 assert(Math.abs(part.path[0].lat-24.935325)<.001);
 assert.throws(()=>client.parse({trip:{status:0,legs:[{shape:'_'}]}}));
});
