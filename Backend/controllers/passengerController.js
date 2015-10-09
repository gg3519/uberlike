var passengerController = function(User,Trip,TaxiLocation,MatchShare,Matche){

var uuid = require('node-uuid');
var moment = require('moment');
var async = require('async');
var underscore = require('underscore');
var validator = require('validator');
var request = require('request');

 // var MatchShare;

  // var matchShareModel = require('../models/matchShare')();
  // var taxiLocationModel = require('../models/taxiLocation')();
  // var tripModel = require('../models/trip')();
  // var userModel = require('../models/user')();

var email = require('../services/email');
var sms = require('../services/sms');

var MatchShare = MatchShare || require('../models/matchShareModel');
var TaxiLocation = TaxiLocation || require('../models/taxiLocationModel');
var Trip = Trip || require('../models/tripModel');
var User = User || require('../models/userModel');
var Matche = Matche || require('../models/matchesModel');

var geocoderProvider = 'google';
var httpAdapter = 'https';
var extra = {
	apiKey: 'AIzaSyDVksvEMbTZTClxjY-touspszFsJSutiIY', // for Mapquest, OpenCage, Google Premier  // YOUR_API_KEY
	formatter: null         // 'gpx', 'string', ...
};
var geocoder = require('node-geocoder')(geocoderProvider, httpAdapter, extra);
var polyline = require('polyline');


 //console.log("passenger moment");
 //console.log(moment("2015-04-13T06:06:08+00:00","YYYY-MM-DDTHH:mm:ssZ").utc().format());

var host = "http://localhost";

 // console.log(moment("2015-09-18T10:15:18Z").format());

console.log(moment(moment(moment("7 October, 2015","DD MMMM, YYYY").format("YYYY-MM-DD")+"T"+moment("6:38 PM","hh:mm a").format("HH:mm:ssZ")).utc().format()).toISOString());
	
		 //  console.log( moment(moment("2015-09-28","YYYY-MM-DD").format("YYYY-MM-DD")+"T"+moment("6:15 pm","hh:mm a").format("HH:mm:ss")).format() );


	  // db.locations.find({ location : { $nearSphere : [ 78.486671,17.385044 ], $maxDistance: (9/6371) } }).pretty();

	 function findNearTaxies(req,res,next){
		var fromLocation = req.body;
		if((fromLocation)&&(fromLocation.coordinates)){
			var distance = fromLocation.distance || 1; // 10
		 // var withInTime = moment.utc().add(5, 'minutes').format('YYYY-MM-DDTHH:mm:ss');
		 //  var taxiResults = [];
			var moreTime = moment.utc().subtract('5','minutes').format(); // YYYY-MM-DDTHH:mm:ssZ

			 TaxiLocation.find({"location" : { $nearSphere : {$geometry: {type : "Point",coordinates : fromLocation.coordinates}, $maxDistance: (distance * 1000) }},"isOccupied":false},function(err2,taxiResult){
							if(err2){
								console.log(err2);
								res.status(500);
								res.send({"status":"error","msg":"error while finding taxi location"});
							//  callback(err2,null);
							}else{
								console.log(taxiResult);
								if((taxiResult)&&(taxiResult.length)){
							 res.status(200);
							 res.send({"status":"success","taxies":taxiResult});
							}else{
							 // callback(null,null);
							 res.status(200);
							 res.send({"status":"success","taxies":[]});
							}
							}
						});
		}else{
			res.status(400);
			res.send({"status":"error","msg":"Some required information is missing."});
		}
	 }


	 function saveSearchData(req,res,next){
		var tripData = req.body;
		if((tripData)&&(tripData.startLocation)&&(tripData.startLocation.location)&&(tripData.endLocation)&&(tripData.endLocation.location)&&(tripData.directionsResult)&&(tripData.timeToLeave)&&(tripData.user_id)){
			var tripObj = {};
			tripObj.type = "Trip";
			tripObj.user_id = tripData.user_id;
			tripObj.startLocation = tripData.startLocation.location;
			tripObj.endLocation = tripData.endLocation.location;
			tripObj.trip_details = "From "+tripData.startLocation.full_address+" to "+tripData.endLocation.full_address;
			tripObj.start_address = tripData.startLocation.full_address;
			tripObj.end_address = tripData.endLocation.full_address;
			tripObj.start_time = moment(tripData.timeToLeave,"YYYY-MM-DDTHH:mm:ssZ").utc().format();  // "2015-04-13T06:06:08+00:00"
		 // tripObj.start_time = moment.utc(tripData.timeToLeave).format();
			tripObj.created_time = moment.utc().format();
			console.log(tripObj);
		     Trip.findOne({"startLocation":{"coordinates":tripObj.startLocation.coordinates,"type":"Point"},"endLocation":{"coordinates":tripObj.endLocation.coordinates,"type":"Point"},"user_id":tripObj.user_id,"start_time":tripObj.start_time},function(errTrip,tripResult){
				if(errTrip){
					res.status(500);
					res.send({"status":"error","msg":"Error while getting the trip results."});
				}else if(tripResult){
					res.status(200);
			res.send({"status":"success","tripObj":tripResult});
				}else{
					tripObj._id = uuid.v4();
			tripObj.Routes = [];
		//  var routes = [];
			async.eachSeries(tripData.directionsResult,function(eachRoute,routeCallback){
			   var routesObj = {};
			   routesObj.type = "Route";
			   //routesObj.coordinates = eachRoute.overview_polyline;
			   routesObj.Legs = [];
				async.eachSeries(eachRoute.legs,function(eachLeg,legCallback){
					var legObj = {};
					legObj.type = "Leg";
					legObj.startLocation = {"type":"Point","coordinates":[eachLeg.start_location.L,eachLeg.start_location.H]};
					legObj.endLocation = {"type":"Point","coordinates":[eachLeg.end_location.L,eachLeg.end_location.H]};
					legObj.distance = eachLeg.distance;
					legObj.duration = eachLeg.duration;
					legObj.start_address = eachLeg.start_address;
					legObj.end_address = eachLeg.end_address;
					legObj.Steps = [];
					async.eachSeries(eachLeg.steps,function(eachStep,stepCallback){
						var stepObj = {};
						stepObj.type = "Step";
						stepObj.distance = eachStep.distance;
						stepObj.duration = eachStep.duration;
						stepObj.startLocation = {"type":"Point","coordinates":[eachStep.start_location.L,eachStep.start_location.H]};
						stepObj.endLocation = {"type":"Point","coordinates":[eachStep.end_location.L,eachStep.end_location.H]};
						stepObj.geometry ={};
								stepObj.geometry.type = "MultiLineString";
								stepObj.geometry.coordinates = [];
						decripted_line(eachStep.polyline.points,function(decriptedLine){
							if((decriptedLine)&&(decriptedLine.length)){
								stepObj.geometry.coordinates = decriptedLine;
								legObj.Steps.push(stepObj);
						stepCallback();
							}else{
								//legObj.steps.push(stepObj);
						stepCallback();
							}
						});
					 // stepObj.encripted_line = polyline.points;
						
					},function(stepErr){
						routesObj.Legs.push(legObj);
						legCallback();
					});

				},function(legErr){
					tripObj.Routes.push(routesObj);
					routeCallback();
				});
			},function(errRoute){
				 var tripObjResult = new Trip(tripObj);
				   tripObjResult.save(function(err,tripResult){
					if(err){
						res.status(500);
						res.send({"status":"error","msg":"error while inserting the trip"});
					}else{
						res.status(200);
						res.send({"status":"success","tripObj":tripObjResult});
					}
				})
			});
					}
			});

		}else{
			res.status(200);
			res.send({"status":"error","msg":"Some information is missing"});
		}
	 }

	 function decripted_line(poliLine,callback){
		var decodedOutput = polyline.decode(poliLine);
		var changedData = [];
		async.eachSeries(decodedOutput,function(eachLine,decodeCallback){
			changedData.push([eachLine[1],eachLine[0]]);
			decodeCallback();
		},function(err){
			callback(changedData);
		});
	 }

	 function findMatches(matchObj,callback){
		var distance = 1;
		var start_time = moment(matchObj.timeToLeave,"YYYY-MM-DDTHH:mm:ssZ").utc().subtract('10','minutes').format();//matchObj.start_time.subtract('10','minutes').format(); // moment.utc()
		var end_time = moment.utc(matchObj.timeToLeave).add('10','minutes').format();  // moment.utc() 
		 Trip.find({"startLocation":{ $nearSphere : {$geometry: matchObj.startLocation, $maxDistance: (distance * 1000) }},"endLocation":{ $nearSphere : {$geometry: matchObj.endLocation, $maxDistance: (distance * 1000) }},"start_time":{$gte:start_time,$lte:end_time}},function(tripErr,tripResults){
			if(tripErr){
				callback(tripErr,null);
			}else{
				callback(null,tripResults);
			}
		});
	 }


	 function findMatchedTrips(req,res,next){
		var routes = req.body;
		var distance = 1;
		var start_time = moment(routes.timeToLeave,"YYYY-MM-DDTHH:mm:ssZ").utc().subtract('10','minutes').format();
		var end_time = moment(routes.timeToLeave,"YYYY-MM-DDTHH:mm:ssZ").utc().add('10','minutes').format();
	     //	console.log(routes.user_id);
		var user_id = routes.user_id;
		var resultTrips = [];

		//   "start_time":{$gte:start_time,$lt:end_time},"user_id":{"$ne":user_id}
		  
		async.parallel({
			start:function(startCallback){
		       Trip.find({"startLocation" : { $nearSphere : {$geometry: routes.startLocation, $maxDistance: (distance * 1000) }},"start_time":{$gte:start_time,$lt:end_time},"user_id":{"$ne":user_id}},startCallback);
			},
			end:function(endCallback){
			   Trip.find({"endLocation": { $nearSphere : {$geometry: routes.endLocation, $maxDistance: (distance * 1000) }},"start_time":{$gte:start_time,$lt:end_time},"user_id":{"$ne":user_id}},endCallback);
			}
		},function(errTrip,matchResult){
			console.log(matchResult);
			if(errTrip){
				console.log("Error:--------");
				console.log(errTrip);
				res.status(500);
				res.send({"status":"error","msg":"Error while getting the trip data"});
			}else if((matchResult)&&(matchResult.start)&&(matchResult.end)&&(matchResult.start.length)&&(matchResult.end.length)){
				var startLocation_ids = underscore.pluck(matchResult.start,'_id');
				var endLocation_ids = underscore.pluck(matchResult.end,'_id');
				console.log(startLocation_ids);
				console.log(endLocation_ids);
				var matchids = underscore.intersection(startLocation_ids,endLocation_ids);
				async.eachSeries(matchids,function(eachMatch_id,tripCallback){
				 var matchObj = underscore.find(matchResult.start, function(obj) { return obj._id == eachMatch_id });
				 matchObj = matchObj.toObject();
				 matchObj.userResult = {};
					 User.findOne({_id:matchObj.user_id},function(err,userResult){
						if(err){
							console.log(err);
							tripCallback(err);
						}else{
						 //	console.log(userResult);
							matchObj.userResult = userResult;
						  //	console.log(matchObj.userResult);
						  //	console.log(matchObj);
							resultTrips.push(matchObj);
							tripCallback();
						}
					});
				},function(tErr){
					if(tErr){
						res.status(500);
						res.send({"status":"error","msg":"Error while getting the user information."});
					}else{
						res.status(200);
						res.send({"status":"success","matches":resultTrips});
					}
				});
			}else{
				res.status(200);
				res.send({"status":"success","matches":resultTrips});
			}
		});
	 }

	 function sendShareMessage(req,res,next){
		var shareData = req.body;
		if(shareData.trip_id){
			var trip_id = shareData.trip_id;
			var user_id = shareData.user_id;
			 Matche.findOne({"trip_id":trip_id,"user_id":user_id},function(errMatch,MatchResults){
				if(errMatch){
					res.status(500);
					res.send({"status":"error","msg":"error while finding the result"});
				}else if(MatchResults){
					res.status(409);
					res.send({"status":"error","msg":"You already sended request to these user"});
				}else{
				   Trip.findOne({"_id":shareData.trip_id},function(errr,tripDetails){
			if(errr){
				res.status(500);
				res.send({"status":"error","msg":"error while getting the trip data."});
			}else if(tripDetails){
			     User.findOne({_id:tripDetails.user_id},function(userErr,userResult){
					if(userErr){
						res.status(500);
						res.send({"status":"error","msg":"error while getting the user information"});
					}else if(userResult){
						var matchObj = {};
						matchObj._id = uuid.v4();
						matchObj.trip_id = tripDetails._id;
						matchObj.user_id = shareData.user_id;
						console.log(tripDetails.start_address);
						console.log(tripDetails.end_address);
						var fromResult = tripDetails.start_address.split(",");
						var toResult = tripDetails.end_address.split(",");
						var url = host+"/"+fromResult[fromResult.length - 3].trim()+"/share-taxi/"+fromResult[fromResult.length - 4].trim()+"-"+toResult[toResult.length - 4].trim()+"/"+matchObj._id;
						async.parallel({
							sms:function(smsCallback){
								var messagetext = "Dear "+userResult.username+"Some one want's to share your taxi between"+fromResult[fromResult.length - 4]+" to "+toResult[toResult.length - 4]+"follow url "+url;
				 var mobilenumber = userResult.phonenumber; 
				 sms(mobilenumber,messagetext,smsCallback);
							},
							email:function(emailCallback){
								var emailValues={};
		emailValues.username = userResult.username;
	 // emilValues.email = data.email;
	 emailValues.from = tripDetails.start_address;
	 emailValues.to = tripDetails.end_address;
	 emailValues.start_time = tripDetails.start_time;
	 emailValues.url = url;
	 // console.log(emilValues);
		app.render("share-ride",emailValues,function(error,html){
			if(error){
				console.log(error,html);
				emailCallback(error,null);
			}else{
				var emailDetails = {};
			emailDetails.email = userResult.email;
			emailDetails.html = html;//"conform mail by click <a href="+emilValues.conformationlink+">here</a>";//html;
			emailDetails.subject = "Share Your trip";
			 email(emailDetails,emailCallback);
							}
						});
	 }
						},function(err,sendResult){
							if(err){
								console.log(err);
								res.status(500);
								res.send({"status":"error","msg":"Error while sending details sms and email","err":err});
							}else{
								var matchObjResult = new Matche(matchObj);
						       matchObjResult.save(function(matchErr,matchResult){
									if(matchErr){
										res.status(500);
										res.send({"status":"error","msg":"Error in match result"});
									}else{
									 //	res.send(200);
									    res.status(200);
										res.send({"status":"success","msg":"you'r share request is processed"});
									}
								});
							}
						});
					}else{
						res.status(404);
						res.send({"status":"error","msg":"user does not exists."});
					}
				});
			}else{
				res.status(404);
				res.send({"status":"error","msg":"trip does not exists"});
			}
		});
				}
			})
		
		}else{
			res.status(400);
			res.send({"status":"error","msg":"Trip data is missing"});
		} 
	 }

	 function contactPage(req,res,next){
		var match_id = req.params.match_id;
		if(match_id){
			 Matche.findOne({"_id":match_id},function(matchErr,shareResults){
				if(matchErr){
					res.status(500);
					res.send({"status":"error","msg":"error while getting the information"});
				}else if(shareResults){

					async.parallel({
						shareUser:function(shareCallback){
						     User.findOne({"_id":shareResults.user_id},shareCallback);
						},
						tripUser:function(tripCallback){
							 Trip.findOne({"_id":shareResults.trip_id},function(tripErr,tripResult){
								if(tripErr){
									tripCallback(tripErr,null);
								}else if(tripResult){
									tripCallback(null,tripResult);
								}else{
									tripCallback(null,null);
								}
							});
						}
					},function(shareErr,matchedInfo){
						if(shareErr){
							res.status(500);
							res.send({"status":"error","msg":"Error while getting the requested user information","err":shareErr});
						}else if((matchedInfo)&&(matchedInfo.shareUser)&&(matchedInfo.tripUser)){
							shareResults.shareUser = matchedInfo.shareUser;
							shareResults.imageUrl = host+'/images/'+matchedInfo.shareUser.image_url;
							shareResults.tripInfo = matchedInfo.tripUser;
							var redirectUrl = req.url;
							console.log(redirectUrl);
							if(req.cookies.redirectUrl){
								res.clearCookie('redirectUrl');
							}
							if(req.cookies.user){
								shareResults.layout = 'share-contact';
						  //        matchedInfo.layout = 'share-contact';
								res.render('share-result',shareResults);
							}else{
								res.cookie('redirectUrl',redirectUrl);
								res.redirect("/");
							}
						}
					});
				}else{
					res.status(404);
					res.send({"status":"error","msg":"your requested url does not match"});
				}
			});
		}else{
			res.status(404);
			res.send({"status":"error","msg":"Some match information is missing"});
		}
	 }

	 function getMatchShareUserInfo(req,res,next){
		var shareObj = req.body;
		async.parallel({
						shareUser:function(shareCallback){
							 User.findOne({"_id":shareObj.user_id},shareCallback);
						},
						tripUser:function(tripCallback){
							  Trip.findOne({"_id":shareObj.trip_id},function(tripErr,tripResult){
								if(tripErr){
									tripCallback(tripErr,null);
								}else if(tripResult){
								      User.findOne({"_id":tripResult.user_id},function(uErr,userResult){
										if(uErr){
											tripCallback(uErr,null);
										}else if(userResult){
											var tripObj = {};
											tripObj = tripResult;
											tripObj.userObj = userResult;
											tripCallback(null,tripObj);
										}
									})
								}else{
									tripCallback(null,null);
								}
							});
						}
					},function(shareErr,matchedInfo){
						if(shareErr){
							res.status(500);
							res.send({"status":"error","msg":"Error while getting the requested user information","err":shareErr});
						}else if((matchedInfo)&&(matchedInfo.shareUser)&&(matchedInfo.tripUser)){
							res.status(200);
							res.send({"status":"success","shareObj":matchedInfo});
						}else{
							res.status(500);
							res.send({"status":"error","msg":"unable to get trip details."});
						}
					});
	 }

	 function contactPassenger(req,res,next){
	 	var contactInfo = req.body;
	 	if((contactInfo.user_id)&&(contactInfo.trip_id)){
	 	async.parallel({
						shareUser:function(shareCallback){
							 User.findOne({"_id":contactInfo.user_id},shareCallback);
						},
						tripUser:function(tripCallback){
							 Trip.findOne({"_id":contactInfo.trip_id},function(tripErr,tripResult){
								if(tripErr){
									tripCallback(tripErr,null);
								}else if(tripResult){
								          User.findOne({"_id":tripResult.user_id},function(uErr,userResult){
										if(uErr){
											tripCallback(uErr,null);
										}else if(userResult){
											var tripObj = {};
											tripObj = tripResult;
											tripObj.userObj = userResult;
											tripCallback(null,tripObj);
										}
									})
								}else{
									tripCallback(null,null);
								}
							});
						}
					},function(shareErr,matchedInfo){
						if(shareErr){
							res.status(500);
							res.send({"status":"error","msg":"Error while getting the requested user information","err":shareErr});
						}else if((matchedInfo)&&(matchedInfo.shareUser)&&(matchedInfo.tripUser)){
							sendMailAndMessage(matchedInfo,function(sErr){
								if(sErr){
									 res.status(500);
									 res.send({"status":"error","msg":"Error while sending email","err":sErr});
								}else{
									res.status(200);
									res.send({"status":"success","msg":"Conformation sended to passenger"});
								}
							})
						}else{
							res.status(500);
							res.send({"status":"error","msg":"unable to get trip details"});
						}
					});
}else{
	res.status(400);
	res.send({"status":"Some user info is missing."});
}
	 }


	 function sendMailAndMessage(tripInfo,cb){
	 	async.parallel({
	 		sms:function(smsCallback){
	 			var mobilenumber = tripInfo.shareUser.phonenumber;
	 			var messagetext = tripInfo.tripUser.userObj.username+" is confirmed you'r request from "+tripInfo.tripUser.start_address+" to "+tripInfo.tripUser.end_address;
	 			sms(mobilenumber,messagetext,smsCallback);
	 		},
	 		email:function(emailCallback){
	 			var emailDetails = {};
	 			emailDetails.from = tripInfo.tripUser.start_address;
	 			emailDetails.to = tripInfo.tripUser.end_address;
	 			emailDetails.tripuser = tripInfo.tripUser.userObj.username;
	 			emailDetails.username = tripInfo.shareUser.username;
	 			app.render('conf-taxi',emailDetails,function(err,html){
	 				if(err){
	 					emailCallback(err,null);
	 				}else{
	 					var emailValues = {};
	 					emailValues.email = tripInfo.shareUser.email;
	 					emailValues.html = html;
	 					emailValues.subject = tripInfo.tripUser.userObj.username+" Confirmed your request.";
	 					email(emailValues,emailCallback);
	 				}
	 			})
	 		}
	 	},function(Errs,sendResult){
	 		if(Errs){
	 			cb(Errs);
	 		}else{
	 			cb();
	 		}
	 	});
	 }


	 // directions url : // 'https://maps.googleapis.com/maps/api/directions/json?origin=hiihi&destination=ihihih&waypoints=iigihi&key=AIzaSyDVksvEMbTZTClxjY-touspszFsJSutiIY';

		function searchData(req,res){
			var shareData = req.body;
			if(shareData){
				if(shareData.from){
					if(shareData.to){
						if(shareData.start_date){
							if(shareData.start_time){
								if(shareData.user_id){
									shareData.timeToLeave = moment(moment(shareData.start_date,"DD MMMM, YYYY").format("YYYY-MM-DD")+"T"+moment(shareData.start_time,"hh:mm a").format("HH:mm:ssZ")).utc().format(); // moment(shareData.start_date+"T"+moment(shareData.start_time,"hh:mm A").format("HH:mm:ss")).format();

var x = 1;

geocoder.geocode(shareData.from, function ( errs, geocodeData ) {
	if((errs)||(!(geocodeData)||(!geocodeData.length))){
		errs = errs || "Error while finding the geocode";
		res.status(500);
		sendError(errs,"Error while geocoding",res);
		
	}else{
		shareData.startLocation = {
				"coordinates":[geocodeData[0].longitude,geocodeData[0].latitude],
				"type":"Point"
			}; 
			geocoder.geocode(shareData.to,function(erre,geoEndData){
	if((erre)||(!geoEndData)||(!(geoEndData.length))){
			erre = erre || "Error while geocoding";
		res.status(500);
		sendError(erre,"Error while geocoding",res);

 }else{
			shareData.endLocation = {
				"coordinates":[geoEndData[0].longitude,geoEndData[0].latitude],
				"type":"Point"
			};
			async.parallel({
	insertMatch:function(shareInsertCallback){
		console.log("I am from insertLocation");
		console.log(shareData.startLocation);
	console.log(shareData.endLocation);
		checkNewUser(shareData,shareInsertCallback);
	},
	matchResults:function(matchCallback){
		console.log("I am from end Location");
		console.log(shareData.startLocation);
	console.log(shareData.endLocation);
		mathedRides(shareData,matchCallback);
	}
},function(matchErr,finalResult){
if(matchErr){
	console.log(matchErr);
	res.status(500);
	sendError(matchErr,"Error while getting matches",res);
}else if((finalResult)&&(finalResult.matchResults)){
 User.findOne({_id:finalResult.insertMatch.user_id},function(err,userObj){
		if(err){
			res.status(500);
			sendError(err,"Error while finding the result",res);
		}else if(userObj){
			finalResult.insertMatch.userResult = userObj;
			res.status(200);
			res.send({"results":finalResult.matchResults});   //  "status":"success","matches":finalResult.matchResults,"matchObj":finalResult.insertMatch
		}else{
			res.status(404);
			sendError(" ","User does not exists",res);
		}
	});
}else{
 // sendError(" ","Error while finding matches",res);
 res.status(200);
 res.send({"results":[]});
}
});
	}
});

	}
});

								}else{
									   res.status(400);
									   sendError(" ","userid is missing",res);
								}
							}else{
								res.status(400);
								sendError(" ","start time is missing",res);
							}
						}else{
							res.status(400);
							sendError(" ","Start date is missing",res);
						}
					}else{
						res.status(400);
						sendError(" ","End location is missing",res);
					}
				}else{
					res.status(400);
					sendError(" ","Start Location is missing",res);
				}
			}else{
				res.status(400);
				sendError(" ","Missing body data",res);
			}
		}



		function checkNewUser(shareInfo,callback){
		  //	shareInfo.timeToLeave = shareInfo.timeToLeave+"Z";
		  //  shareInfo.timeToLeave = moment(shareInfo.timeToLeave,"YYYY-MM-DDTHH:mm:ss").toISOString(); // "start_time": shareInfo.timeToLeave,
		    //console.log(shareInfo);
			 MatchShare.findOne({"startLocation":shareInfo.startLocation,"endLocation":shareInfo.endLocation,"user_id":shareInfo.user_id},function(matchError,matchResult){
				 console.log("match results");
				 console.log(matchResult);				
				if(matchError){
					console.log(matchError);
					callback(matchError,null);
				}else if(matchResult){
					console.log("matchResult found");
				 //	console.log(matchResult);
					var updateObj = {};
						updateObj._id = matchResult._id;
					if(matchResult.split_amount){
						if(shareInfo.splitAmount){
							if((matchResult.split_amount == shareInfo.splitAmount)){
						callback(null,matchResult);
					}else{
						updateObj.car = 1;
						updateObj.split_amount = shareInfo.splitAmount;
						// update it in database
						updateMatches(updateObj,callback);
						}
					}else{
						updateObj.car = 0;
						updateObj.split_amount = 0;
						//update it
						updateMatches(updateObj,callback);
					}
					}else if(shareInfo.splitAmount){
						updateObj.car = 1;
						updateObj.split_amount = shareInfo.splitAmount;
						// update in db
						updateMatches(updateObj,callback);
					}else{
						callback(null,matchResult);
					}

				}else{
					console.log("match result not found");
						var url = "https://maps.googleapis.com/maps/api/directions/json?origin="+shareInfo.from+"&destination="+shareInfo.to+"&key=AIzaSyDVksvEMbTZTClxjY-touspszFsJSutiIY";   // &waypoints=iigihi
									request(url, function (error, response, directIonResult) {
										if(directIonResult){
											directIonResult = JSON.parse(directIonResult);
										}
  if (!error &&  (response.statusCode == 200) && (directIonResult) && (directIonResult.status == "OK")) {


  //  res.send(directIonResult);

			var tripObj = {};
			tripObj.type = "Trip";
			tripObj.user_id = shareInfo.user_id;
			tripObj.startLocation =   shareInfo.startLocation; //  tripData.startLocation.location;
			tripObj.endLocation =     shareInfo.endLocation; // tripData.endLocation.location;
			tripObj.trip_details = "From "+shareInfo.from+" to "+shareInfo.to;
			tripObj.start_address = shareInfo.from;
			tripObj.end_address = shareInfo.to;  //tripData.endLocation.full_address;
			tripObj.start_time = shareInfo.timeToLeave;//moment(tripData.timeToLeave,"YYYY-MM-DDTHH:mm:ssZ").utc().format();  // "2015-04-13T06:06:08+00:00"
		 // tripObj.start_date = shareData.start_date;
		 // tripObj.start_time = moment.utc(tripData.timeToLeave).format();
			tripObj.created_time = moment.utc().format();
			tripObj.split_amount = shareInfo.splitAmount;
			if(tripObj.split_amount){
			tripObj.car = 1;
			}else{
			tripObj.car = 0;
			}
		tripObj._id = uuid.v4();
			tripObj.Routes = [];
		//  var routes = [];
			async.eachSeries(directIonResult.routes,function(eachRoute,routeCallback){
			   var routesObj = {};
			   routesObj.type = "Route";
			   //routesObj.coordinates = eachRoute.overview_polyline;
			   routesObj.Legs = [];
				async.eachSeries(eachRoute.legs,function(eachLeg,legCallback){
					var legObj = {};
					legObj.type = "Leg";
					legObj.startLocation = {"type":"Point","coordinates":[eachLeg.start_location.lng,eachLeg.start_location.lat]};
					legObj.endLocation = {"type":"Point","coordinates":[eachLeg.end_location.lng,eachLeg.end_location.lat]};
					legObj.distance = eachLeg.distance;
					legObj.duration = eachLeg.duration;
					legObj.start_address = eachLeg.start_address;
					legObj.end_address = eachLeg.end_address;
					legObj.Steps = [];
					async.eachSeries(eachLeg.steps,function(eachStep,stepCallback){
						var stepObj = {};
						stepObj.type = "Step";
						stepObj.distance = eachStep.distance;
						stepObj.duration = eachStep.duration;
						stepObj.startLocation = {"type":"Point","coordinates":[eachStep.start_location.lng,eachStep.start_location.lat]};
						stepObj.endLocation = {"type":"Point","coordinates":[eachStep.end_location.lng,eachStep.end_location.lat]};
						stepObj.geometry ={};
								stepObj.geometry.type = "MultiLineString";
								stepObj.geometry.coordinates = [];
						decripted_line(eachStep.polyline.points,function(decriptedLine){
							if((decriptedLine)&&(decriptedLine.length)){
								stepObj.geometry.coordinates = decriptedLine;
								legObj.Steps.push(stepObj);
						stepCallback();
							}else{
								//legObj.steps.push(stepObj);
						stepCallback();
							}
						});
					 // stepObj.encripted_line = polyline.points;
						
					},function(stepErr){
						routesObj.Legs.push(legObj);
						legCallback();
					});

				},function(legErr){
					tripObj.Routes.push(routesObj);
					routeCallback();
				});
			},function(errRoute){
				var matchShareObj = new MatchShare(tripObj);
			     matchShareObj.save(function(err,tripResult){
					if(err){
						callback(err,null);
					 // res.send({"status":"error","msg":"error while inserting the trip"});
					}else{
					 // res.send({"status":"success","tripObj":tripObj});
					 callback(null,tripObj);
					}
				});
			});
  }else{
  //    console.log(response);
	console.log(response.statusCode);
	console.log(directIonResult.status);
  //    console.log(directIonResult);
	var errMsg = error || directIonResult.status;
  //    sendError(errMsg,"Error while getting the directions",res);
		callback(errMsg,null);
  }
});
				}
			});
		}

		function mathedRides(matchData,callback){
		 //	console.log(matchData.startLocation);
		 //	console.log(matchData.endLocation);
			var distance = 1;
		var start_time = moment(matchData.timeToLeave,"YYYY-MM-DDTHH:mm:ssZ").utc().subtract('10','minutes').format();
		var end_time = moment(matchData.timeToLeave,"YYYY-MM-DDTHH:mm:ssZ").utc().add('10','minutes').format();
		var user_id = matchData.user_id;
		var resultTrips = [];

		// "start_time":{$gte:start_time,$lt:end_time},"user_id":{"$ne":user_id}

		async.parallel({
			start:function(startCallback){
				MatchShare.find({"startLocation" : { $nearSphere : {$geometry: matchData.startLocation, $maxDistance: (distance * 1000) }},"start_time":{$gte:start_time,$lt:end_time},"user_id":{"$ne":user_id}},{"trip_details":false,"Routes":false},startCallback); // "start_time":{$gte:start_time,$lt:end_time},"user_id":{"$ne":user_id}
			},
			end:function(endCallback){
			    MatchShare.find({"endLocation": { $nearSphere : {$geometry: matchData.endLocation, $maxDistance: (distance * 1000) }},"start_time":{$gte:start_time,$lt:end_time},"user_id":{"$ne":user_id}},{"trip_details":false,"Routes":false},endCallback); // "start_time":{$gte:start_time,$lt:end_time},"user_id":{"$ne":user_id}
			}
		},function(errTrip,matchResult){
		 //	console.log(matchResult);
			if(errTrip){
				console.log("Error:--------");
				console.log(errTrip);
			 // res.send({"status":"error","msg":"Error while getting the trip data"});
				callback(errTrip,null);
			}else if((matchResult)&&(matchResult.start)&&(matchResult.end)&&(matchResult.start.length)&&(matchResult.end.length)){
				var startLocation_ids = underscore.pluck(matchResult.start,'_id');
				var endLocation_ids = underscore.pluck(matchResult.end,'_id');
			 //	console.log(startLocation_ids);
			 //	console.log(endLocation_ids);
				var matchids = underscore.intersection(startLocation_ids,endLocation_ids);
				var resultObj = {};
				async.eachSeries(matchids,function(eachMatch_id,tripCallback){
				 var matchObj = underscore.find(matchResult.start, function(obj) { return obj._id == eachMatch_id });
				 if(matchObj){
					resultObj.id = matchObj._id;
					resultObj.rideType = "taxiBooked";  // noTaxiBooked // matchObj.car;
					resultObj.startAddress = matchObj.start_address;
					resultObj.startLocation ={"lat": matchObj.startLocation.coordinates[1],"lng":matchObj.startLocation.coordinates[0] };
					resultObj.endAddress = matchObj.end_address;
					resultObj.endLocation = {"lat":matchObj.endLocation.coordinates[1],"lng":matchObj.endLocation.coordinates[0]};
					resultObj.currentLocation = resultObj.startLocation;
					resultObj.cabService = "Uber";
					resultObj.cabServiceLogo = host+"/images/uberLogo.jpg";
					resultObj.carType = "Indica A/C";
					resultObj.startDate = moment(matchObj.start_time).format("DD MMMM, YYYY");
					resultObj.startTime = moment(matchObj.start_time).format("hh:mm a");
					 User.findOne({"_id":matchObj.user_id},{"_id":true,"provider_id":true,"username":true,"email":true,"phonenumber":true,"image_url":true},function(err,userResult){
						if(err){
							tripCallback(err);
						}else{
							//matchObj.userResult = userResult;
							//console.log(userResult);
							resultObj.initiator = {};
							resultObj.initiator.id = userResult._id;
							resultObj.initiator.email = userResult.email;
							resultObj.initiator.firstName = userResult.firstName;
							resultObj.initiator.lastName = userResult.lastName;
							resultObj.initiator.mobileNumber = userResult.phonenumber;
							resultObj.initiator.gender = userResult.gender;
							resultObj.initiator.facebookId = userResult.provider_id;
							resultObj.initiator.profilePicture = host+"/images/"+userResult.image_url;
							resultObj.passengers = [];
							var obj = {
		  "id":"4535454554",
		  "facebookId":"45345453525454254543545",
		  "firstName":"Setu",
		  "lastName":"Saurabh",
		  "email":"setu@rideshare.co",
		  "mobileNumber":"null",
		  "gender":"male",
		  "profilePicture":"http:/rideshare.co/images/45345453525454254543545.jpg"
		};
							var obj1 = {
		  "id":"4535454554",
		  "facebookId":"45345453525454254543545",
		  "firstName":"Mannat",
		  "lastName":"Saini",
		  "email":"mannat@rideshare.co",
		  "mobileNumber":"null",
		  "gender":"male",
		  "profilePicture":"http:/rideshare.co/images/45345453525454254543545.jpg"
		};
							resultObj.totalSeats = 4;
							resultObj.passengers.push(obj);
							resultObj.passengers.push(obj1);
							resultObj.availableSeats = resultObj.totalSeats - resultObj.passengers.length;
							resultObj.price = matchObj.split_amount;
							resultObj.savings = (resultObj.price) - ((resultObj.price * resultObj.availableSeats)/(resultObj.totalSeats - resultObj.availableSeats + 1)); 
							resultTrips.push(resultObj);
							tripCallback();
						}
					});
				 }
				 
					/*
					   findUserById(matchObj.user_id,function(err,userResult){
						if(err){
							tripCallback(err);
						}else{
							matchObj.userResult = userResult;
							resultTrips.push(matchObj);
							tripCallback();
						}
					});
				*/
				},function(tErr){
					if(tErr){
						callback(tErr,null);
					}else{

				 //     res.send({"status":"success","matches":resultTrips});
						callback(null,resultTrips);
					}
				});
			}else{
			   //   res.send({"status":"success","matches":resultTrips});
					   callback(null,resultTrips);
			}
		});
		}

		function sendError(err,msg,res){
			res.send({"status":"error","msg":msg,"err":err});
		}

		function updateMatches(matchObj,callback){
			var car = matchObj.car;
			var split_amount = matchObj.split_amount;
			MatchShare.update({"_id":matchObj._id},{"$set":{"car":car,"split_amount":split_amount}},callback);
		}

		// var cron = require('node-schedule');

	return {
		findNearTaxies:findNearTaxies,
		saveSearchData:saveSearchData,
		findMatchedTrips:findMatchedTrips,
		sendShareMessage:sendShareMessage,
		contactPage:contactPage,
		searchData:searchData,
		getMatchShareUserInfo:getMatchShareUserInfo,
		contactPassenger:contactPassenger
	}
};
module.exports = passengerController;