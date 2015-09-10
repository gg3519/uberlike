module.exports = (function(){

var uuid = require('node-uuid');
var moment = require('moment');
var async = require('async');
var validator = require('validator');


	function searchedLocations(req,res,next){
	var locationData = req.body;
	if((locationData)&&(locationData.user_id)&&(locationData.present_lat)&&(locationData.present_lng)&&(locationData.dest_lat)&&(locationData.dest_lng)&&(locationData.time)){
		locationData._id = uuid.v4();
		locationData.date = moment().format('YYYY-MM-DD'); // HH:mm:ss
		db.collection("passengers").insert(locationData,function(err,result){
			if(err){
				res.send({"status":"error","msg":"Error while inserting user location."});
			}else{
				res.send({"status":"success","msg":"Successfully updated the searching details","passenger":locationData});
			}
		});
	}else{
		res.send({"status":"error","msg":"Missing some userinfo"});
	}
}

	function saveUserLocation(req,res,next){
		var locationData = req.body;
		if((locationData)&&(locationData.user_id)&&(locationData.fulladdress)&&(locationData.location)){
			locationData._id = uuid.v4();
			locationData.time = moment.utc().format(); // YYYY-MM-DDTHH:mm:ssZ 
			db.collection("location").findOne({"location":locationData.location},function(err,result){
				if(err){
					res.send({"status":"error","msg":"Error while getting info"});
				}else if(result){
					res.send({"status":"success2","msg":"Location already exists"});
				}else{
					db.collection("location").insert(locationData,function(err,results){
						if(err){
							res.send({"status":"error","msg":"Error while updating location"});
						}else{
							res.send({"status":"success","data":locationData});
						}
					});
				}
			});
		}else{
			res.send({"status":"error","msg":"some fields are missing"});
		}
	}

	function setLocation(req,res,next){
		var location = req.body;
		console.log(location);
		if((location)&&(location.location)&&(location.full_address)){
			location._id = uuid.v4();
			db.collection("locations").findOne({"location":location.location},function(err,result){
				if(err){
					res.send({"status":"error","msg":"Error while getting the location"});
				}else if(result){
					res.send({"status":"success","location":result});
				}else{
						db.collection("locations").insert(location,function(err,result){
				if(err){
					res.send({"status":"error","msg":"Error while inserting location"});
				}else{
					res.send({"status":"success","location":location});
				}
			});
				}
			});
			
		}else{
			res.send({"status":"error","msg":"Location or address is missing."});
		}
	}


	  // db.locations.find({ location : { $nearSphere : [ 78.486671,17.385044 ], $maxDistance: (9/6371) } }).pretty();

	 function findNearTaxies(req,res,next){
	 	var fromLocation = req.body;
	 	if((fromLocation)&&(fromLocation.coordinates)){
	 		var distance = fromLocation.distance || 4;
	 	 //	var withInTime = moment.utc().add(5, 'minutes').format('YYYY-MM-DDTHH:mm:ss');
	 	 var taxiResults = [];
	 	 	var moreTime = moment.utc().subtract('5','minutes').format(); // YYYY-MM-DDTHH:mm:ssZ
	 		db.collection("locations").find({"location" : { $nearSphere : fromLocation.coordinates, $maxDistance: (distance/6371) }}).toArray(function(err,results){
	 			 if(err){
	 			 	 res.send({"status":"error","msg":"Error while getting location information"});
	 			 }else if((results)&&(results.length)){
	 			 	console.log("coming to results");
	 			 	console.log(results);
	 			 	var locationWiseTaxies = [];
	 			 	  async.each(results,function(eachLocation,callback){
	 			 	  	db.collection("taxi_location").find({"location_id":eachLocation._id,"isOccupied":false,"date_time": { $gte:moreTime }}).toArray(function(err2,taxiResult){
	 			 	  		if(err2){
	 			 	  			callback(err2,null);
	 			 	  		}else{
	 			 	  			console.log(taxiResult);
	 			 	  			if((taxiResult)&&(taxiResult.length)){
	 			 	  				eachLocation.taxies = taxiResult;
	 			 	  				console.log(eachLocation);
	 			 	  	 //			taxiResuts.push(eachLocation);
	 			 	  	 			taxiResults.push(eachLocation);
	 			 	  			console.log("coming here to if condition");
	 			 	  			 //	console.log(taxiResult);
	 			 	  			callback(null,eachLocation);
	 			 	  		}else{
	 			 	  			callback(null,null);
	 			 	  		}
	 			 	  		}
	 			 	  	});
	 			 	  },function(err1,eachResult){
	 			 	  	if(err1){
	 			 	  		res.send({"status":"error","msg":"error while getting the taxies"});
	 			 	  	}else{
	 			 	  		// eachResult = eachResult || [];
	 			 	  		res.send({"status":"success","taxies":taxiResults});
	 			 	  	}
	 			 	  });
	 			 }else{
	 			 	res.send({"status":"success","taxies":[]});
	 			 }
	 		});

	 	}else{
	 		res.send({"status":"error","msg":"Some required information is missing."});
	 	}
	 }


	return {
		searchedLocations:searchedLocations,  // searchedlocation
		saveUserLocation:saveUserLocation,    // savelocation
		setLocation:setLocation,
		findNearTaxies:findNearTaxies
	}

})();