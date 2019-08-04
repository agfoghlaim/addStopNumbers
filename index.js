/*

This file reads timetablesIn.json (bus times and stop names copied and pasted), looks up their bus stop number, formats them into a more useful JSON and saves to timetablesOut.json

*/

const fs = require('fs');
const timetables = require('./timetablesIn')
const routes = timetables.routes;
const axios = require('axios');



//first get the routes
  let routesOnly = routes.map(route=>{
    return {
      route:route.routeNo,
      routename: route.routeName,
      direction: route.direction,
      stops: []
    }
  })


//then get stopnames (add to routesOnly)
let stopsOnly = routesOnly.map((emptyRoute,i)=>{
    let stops =  routes[i].bus_times_week.map((stop,i)=>{
      return {
        name: stop[0],
        bestopid: '',
        stop_sequence: i+1,
        bus_times_week: [],
        bus_times_sat:[],
        bus_times_sun:[]
      }
    })
  emptyRoute.stops.push(...stops)
  return emptyRoute
})

//get the stop ids (add to stopsOnly)
async function loopRoutes(){
  const withStops= stopsOnly.map(async route=>{
    const res = await plusIds(route)
    route.stops = res
    return route
  })
  const results = await Promise.all(withStops)
  //console.log("results,an array of routes with everything execpt bus times", results)
  let complete = addInTimes(results)

  let h = JSON.stringify(complete,null, 1)
    fs.writeFile(`timetablesOut.json`, h, 'utf8', function(err,data){
    console.log(err,'done, ok')
  });
}

async function plusIds(route){
  let endpoint = `https://rtpiapp.rtpi.openskydata.com/RTPIPublicService_v2/service.svc/busstopinformation?stopname=`
  const promises = route.stops.map(async stop=>{
    try{
      const response = await axios.get(`${endpoint}${stop.name}`)
      stop.bestopid = response.data.results[0].stopid
      return stop
    }catch (error) {
      console.error(error);
    }
 
  })  
  const results = await Promise.all(promises)
  return results;
}

/*
loop routes produces this format...
[
  {
   "route": "402",
   "routename": "Seacrest - Eyre Square - Merlin Park",
   "direction": "E",
   "stops":[
     {
      "name":"have the name",
      "bestopid": "have the id",
      "bus_times_week": [empty array]
      }
    ]
  },
  {next route}
]
 */

loopRoutes();

//called after the bestopids are added
//rts param will have everything except times
function addInTimes(rts){
  let endRoutes = rts.map((rt,i)=>{
    let newStops = rt.stops.map((stop,j)=>{
      stop.bus_times_week = getTimes(i,j,'bus_times_week');
      stop.bus_times_sat = getTimes(i,j,'bus_times_sat');
      stop.bus_times_sun = getTimes(i,j,'bus_times_sun');
      return stop;
    })
    return newStops;
  })
  rts.stops = endRoutes
  return rts
}

//get times takes route index and stop index of the new version being constructed
//have to use indexes to get the correct times out of the routes const
//st index will map to 'bus_times_week[st][1] 
function getTimes(rt,st,day){

   //buses is for ref to get string route+dir+depFromFirstStopTime which will act as a bus id
   let buses = routes[rt][day][0][1].map(depFromStopOneTime=>{
     return `${routes[rt].routeNo}${routes[rt].direction}${depFromStopOneTime.replace(':','')}`
   })

  let times = routes[rt][day][st][1]
  let timesPlus = times.map((time,i)=>{
    return {bus:buses[i],time:time}
  })
  return timesPlus;
}



