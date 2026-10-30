const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const client=require('../assets/open-route-client'),geo=require('../assets/route-geometry');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../trips/2026/qiedigua/route-data.js'),'utf8'),scope);
const data=scope.window.TRIP_DATA,features=JSON.parse(fs.readFileSync(require.resolve('../trips/2026/qiedigua/road-routes.geojson'),'utf8')).features;
const audit=require('../trips/2026/qiedigua/road-route-audit.json');
const groups=data.days.flatMap(d=>[{id:d.id,nodes:d.mapPoints.map(p=>p.slice(0,2))},...(d.alternative?[{id:d.id+'-alternative',nodes:d.alternative.mapPoints.map(p=>p.slice(0,2))}]:[])]).concat({id:'day-1-western',nodes:data.controlMap.western.points});
test('all seven saved production routes match the current requests and waypoints',()=>{
 assert.equal(features.length,7);
 for(const group of groups){const f=features.find(f=>f.properties.groupId===group.id);assert(f,group.id);assert.equal(f.properties.signature,JSON.stringify(group.nodes));assert.equal(f.properties.routingVersion,client.version);assert.equal(f.properties.costing,'motor_scooter');assert.equal(f.properties.verifiedForNavigation,false);
 const part=client.parse({trip:{status:0,legs:[{shape:f.geometry,summary:{length:f.properties.distanceKm}}]}})[0];assert(part.path.length>3000);const m=geo.measure(part.path);for(const [lat,lng] of group.nodes)assert(geo.project(m,{lat,lng}).distance<=600,group.id);assert(Math.abs(m.total/1000-part.distance)/part.distance<.04,group.id);
 const a=audit[group.id];assert.equal(a.requestVersion,client.version);assert(a.joinsMeters.every(gap=>gap<=2));for(const b of a.batches){assert.equal(b.status,0);assert.equal(b.summary.has_highway,false);assert.equal(b.summary.has_ferry,false);assert(b.legs.every(l=>l.maneuvers.every(m=>m.travel_type==='motor_scooter')));}
 }
});
test('control overlays use the saved road geometry and uncertain worksites remain unlocated',()=>{
 const matched=new Set();
 for(const f of features){const path=f.geometry.coordinates.map(([lng,lat])=>({lat,lng})),m=geo.measure(path);for(const item of data.controlMap.sections){const slice=geo.mileageSlice(path,item.geometry||{});if(!slice.length)continue;matched.add(item.id);for(const p of slice)assert(geo.project(m,p).distance<.1,item.id);}}
 for(const id of ['control-1','control-2','control-3','control-4','control-5','control-songquan','control-jiugong'])assert(matched.has(id),id);
 assert(!matched.has('control-0'),'Daman reference mileposts do not match the returned road');assert(!matched.has('control-6'),'Mataian worksite has not been located on the saved road');
});
