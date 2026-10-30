/* Keyless OSM routing. Never substitutes a straight line for a missing road path. */
((root) => {
  'use strict';
  function request(nodes) {
    if(nodes.length<2 || nodes.length>16)throw new Error('INVALID_WAYPOINTS');
    return {
      locations:nodes.map(([lat,lon],index)=>({lat,lon,type:index===0 || index===nodes.length-1 ? 'break' : 'through',radius:400})),
      costing:'motor_scooter',
      costing_options:{motor_scooter:{use_highways:0,use_tolls:0,use_ferry:0,use_hills:1,top_speed:80,exclude_highways:true,exclude_tolls:true,exclude_ferries:true}},
      shape_format:'geojson',directions_type:'none',directions_options:{units:'kilometers'}
    };
  }
  function chunks(nodes) {
    const out=[];
    for(let i=0;i<nodes.length-1;i+=15)out.push(nodes.slice(i,i+16));
    return out;
  }
  function parse(response) {
    if(response?.trip?.status!==0 || !response.trip.legs?.length)throw new Error('NO_ROUTE');
    return response.trip.legs.map(leg=>{
      const coordinates=leg.shape?.type==='LineString' ? leg.shape.coordinates : null;
      if(!Array.isArray(coordinates) || coordinates.length<2 || coordinates.some(p=>!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || p[0]<119 || p[0]>123 || p[1]<21 || p[1]>26))throw new Error('INVALID_PATH');
      return {path:coordinates.map(([lng,lat])=>({lat,lng})),distance:leg.summary?.length || 0,seconds:leg.summary?.time || 0};
    });
  }
  const api={request,chunks,parse};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.OpenRouteClient=api;
})(typeof window!=='undefined' ? window : globalThis);
