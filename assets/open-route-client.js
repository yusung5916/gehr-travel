/* Keyless OSM routing. Never substitutes a straight line for a missing road path. */
((root) => {
  'use strict';
  function request(nodes) {
    if(nodes.length<2 || nodes.length>10)throw new Error('INVALID_WAYPOINTS');
    return {
      locations:nodes.map(([lat,lon],index)=>({lat,lon,type:index===0 || index===nodes.length-1 ? 'break' : 'through',radius:20,search_filter:{min_road_class:'residential'}})),
      costing:'motor_scooter',
      costing_options:{motor_scooter:{use_highways:0,use_tolls:0,use_ferry:0,use_hills:1,top_speed:80,exclude_highways:true,exclude_tolls:true,exclude_ferries:true,exclude_unpaved:true}},
      shape_format:'polyline6',directions_type:'instructions',directions_options:{units:'kilometers'}
    };
  }
  function chunks(nodes) {
    const out=[];
    for(let i=0;i<nodes.length-1;i+=9)out.push(nodes.slice(i,i+10));
    return out;
  }
  function decodePolyline(encoded) {
    const coordinates=[];let index=0,lat=0,lng=0;
    function delta(){let value=0,shift=0,byte;do{if(index>=encoded.length || shift>30)throw new Error('INVALID_PATH');byte=encoded.charCodeAt(index++)-63;if(byte<0 || byte>63)throw new Error('INVALID_PATH');value|=(byte&31)<<shift;shift+=5;}while(byte>=32);return value&1 ? ~(value>>>1) : value>>>1;}
    while(index<encoded.length){lat+=delta();lng+=delta();coordinates.push([lng/1e6,lat/1e6]);}
    return coordinates;
  }
  function parse(response) {
    if(response?.trip?.status!==0 || !response.trip.legs?.length)throw new Error('NO_ROUTE');
    return response.trip.legs.map(leg=>{
      if(leg.maneuvers?.some(m=>m.travel_type && m.travel_type!=='motor_scooter'))throw new Error('INVALID_PATH');
      const coordinates=leg.shape?.type==='LineString' ? leg.shape.coordinates : typeof leg.shape==='string' ? decodePolyline(leg.shape) : null;
      if(!Array.isArray(coordinates) || coordinates.length<2 || coordinates.some(p=>!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || p[0]<119 || p[0]>123 || p[1]<21 || p[1]>26))throw new Error('INVALID_PATH');
      return {path:coordinates.map(([lng,lat])=>({lat,lng})),distance:leg.summary?.length || 0,seconds:leg.summary?.time || 0};
    });
  }
  const api={version:3,request,chunks,parse};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.OpenRouteClient=api;
})(typeof window!=='undefined' ? window : globalThis);
