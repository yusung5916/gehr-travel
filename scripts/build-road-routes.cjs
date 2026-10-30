/* Build OSM snapshots once so visitors do not depend on a live routing service. */
const fs=require('fs'),path=require('path'),vm=require('vm'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const client=require('../assets/open-route-client.js'),geo=require('../assets/route-geometry.js');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'trips/2026/qiedigua/route-data.js'),'utf8'),scope);
const data=scope.window.TRIP_DATA,out=path.join(root,'trips/2026/qiedigua/road-routes.geojson');
const existing=JSON.parse(fs.readFileSync(out,'utf8'));
const auditPath=path.join(root,'trips/2026/qiedigua/road-route-audit.json');
const audit=fs.existsSync(auditPath)?JSON.parse(fs.readFileSync(auditPath,'utf8')):{};
const groups=[];
for(const day of data.days){
 const nodes=day.mapPoints.map(p=>p.slice(0,2));if(day.meeting && data.meeting.coordinates)nodes.unshift(data.meeting.coordinates);
 groups.push({id:day.id,nodes});
 if(day.alternative)groups.push({id:day.id+'-alternative',nodes:day.alternative.mapPoints.map(p=>p.slice(0,2))});
}
groups.push({id:'day-1-western',nodes:data.controlMap.western.points});
(async()=>{
 let last=0,failed=0;
 for(const group of groups){
  const signature=JSON.stringify(group.nodes);
  if(!process.argv.includes('--refresh') && existing.features.some(f=>f.properties.groupId===group.id && f.properties.signature===signature && f.properties.routingVersion===client.version)){console.log(group.id+': snapshot already present');continue;}
  try{
   const parts=[],responses=[],checks=[],joins=[];
   for(const batch of client.chunks(group.nodes)){
    const wait=1200-(Date.now()-last);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));last=Date.now();
    const result=spawnSync('curl',['--fail-with-body','--silent','--show-error','--max-time','45','--get','-H','X-Client-Id: gehr-travel-personal-itinerary-build','--data-urlencode','json='+JSON.stringify(client.request(batch)),'https://valhalla1.openstreetmap.de/route'],{encoding:'utf8',maxBuffer:16*1024*1024});
    if(result.status!==0)throw new Error((result.stderr || 'Connection failed').trim());
    const response=JSON.parse(result.stdout),received=client.parse(response),m=geo.measure(received.flatMap(p=>p.path));
    responses.push(response);checks.push(batch.map(([lat,lng])=>({lat,lng,...geo.project(m,{lat,lng})})));
    if(batch.some(([lat,lng])=>geo.project(m,{lat,lng}).distance>600))throw new Error('Waypoint mismatch: '+JSON.stringify(checks.at(-1).filter(p=>p.distance>600)));
    if(parts.length){const gap=geo.distance(parts.at(-1).path.at(-1),received[0].path[0]);joins.push(gap);if(gap>2)throw new Error('Disconnected route: '+gap.toFixed(1)+'m');}
    if(response.trip.summary?.has_highway || response.trip.summary?.has_ferry || response.trip.summary?.has_toll)throw new Error('Unexpected highway, ferry or toll route');
    parts.push(...received);
   }
   existing.features=existing.features.filter(f=>f.properties.groupId!==group.id);
   existing.features.push({type:'Feature',properties:{groupId:group.id,signature,routingVersion:client.version,source:'OpenStreetMap / Valhalla',costing:'motor_scooter',verifiedForNavigation:false,generatedAt:new Date().toISOString(),distanceKm:parts.reduce((n,p)=>n+p.distance,0)},geometry:{type:'LineString',coordinates:parts.flatMap(p=>p.path.map(p=>[p.lng,p.lat]))}});
   audit[group.id]={generatedAt:new Date().toISOString(),costing:'motor_scooter',requestVersion:client.version,joinsMeters:joins,waypoints:checks,batches:responses.map(r=>({status:r.trip.status,summary:r.trip.summary,legs:r.trip.legs.map(l=>({summary:l.summary,maneuvers:l.maneuvers}))}))};
   fs.writeFileSync(auditPath,JSON.stringify(audit,null,2)+'\n');
   fs.writeFileSync(out,JSON.stringify(existing));console.log(group.id+': saved '+parts.reduce((n,p)=>n+p.path.length,0)+' road vertices');
  }catch(error){failed++;console.error(group.id+': '+error.message);}
 }
 if(failed)process.exitCode=1;
})();
