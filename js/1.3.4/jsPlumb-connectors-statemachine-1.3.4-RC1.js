/*
state machine connectors

thanks to Brainstorm Mobile Solutions for supporting the development of these.

*/
;(function() {


	var Line = function(x1, y1, x2, y2) {

	this.m = (y2 - y1) / (x2 - x1);
	this.b = -1 * ((this.m * x1) - y1);
	
	this.rectIntersect = function(x,y,w,h) {

		// so y = b
		var results = [];
		// try top face
		// the equation of the top face is y = (0 * x) + b; y = b.
//		y = this.m * X + this.b
//		y - this.b = this.m * X
		var xInt = (y - this.b) / this.m;
		// test that the X value is in the line's range.
		if (xInt >= x && xInt <= (x + w)) results.push([ xInt, (this.m * xInt) + this.b ]);
		
		// try right face
		var yInt = (this.m * (x + w)) + this.b;
		if (yInt >= y && yInt <= (y + h)) results.push([ (yInt - this.b) / this.m, yInt ]);
		
		// bottom face
		var xInt = ((y + h) - this.b) / this.m;
		// test that the X value is in the line's range.
		if (xInt >= x && xInt <= (x + w)) results.push([ xInt, (this.m * xInt) + this.b ]);
		
		// try left face
		var yInt = (this.m * x) + this.b;
		if (yInt >= y && yInt <= (y + h)) results.push([ (yInt - this.b) / this.m, yInt ]);

		if (results.length == 2) {
			var midx = (results[0][0] + results[1][0]) / 2, midy = (results[0][1] + results[1][1]) / 2;
			results.push([ midx,midy ]);
			// now calculate the segment inside the rectangle where the midpoint lies.
			var xseg = midx <= x + (w / 2) ? -1 : 1,
			yseg = midy <= y + (h / 2) ? -1 : 1;
			results.push([xseg, yseg]);
			return results;
		}
		
		return null;

	};
};

	/*
		Function: StateMachine constructor
		
		Allowed parameters:
			curviness 		-	measure of how "curvy" the connectors will be.  this is translated as the distance that the
								Bezier curve's control point is from the midpoint of the straight line connecting the two
								endpoints, and does not mean that the connector is this wide.  The Bezier curve never reaches
								its control points; they act as gravitational masses. defaults to 10.
			margin			-	distance from element to start and end connectors, in pixels.  defaults to 5.
			proximityLimit  -   sets the distance beneath which the elements are consider too close together to bother with fancy
			                    curves. by default this is 80 pixels.
	*/
	jsPlumb.Connectors.StateMachine = function(params) {
		var self = this,
		currentPoints = null,
		_m, _m2, _b, _dx, _dy, _theta, _theta2, _sx, _sy, _tx, _ty, _controlX, _controlY,
		curviness = params.curviness || 10,
		margin = params.margin || 5,
		proximityLimit = params.proximityLimit || 80,
		clockwise = params.orientation && params.orientation == "clockwise",
		isLoopback = false;

		this.type = "StateMachine";
		params = params || {};		
		
		this.compute = function(sourcePos, targetPos, sourceEndpoint, targetEndpoint, sourceAnchor, targetAnchor, lineWidth, minWidth) {

			var w = Math.abs(sourcePos[0] - targetPos[0]),
   	 	       	h = Math.abs(sourcePos[1] - targetPos[1]),
	   	     	// these are padding to ensure the whole connector line appears
   	   	   		xo = 0.45 * w, yo = 0.45 * h;
   		   		// these are padding to ensure the whole connector line appears
            	w *= 1.9; h *= 1.9,            
            	x = Math.min(sourcePos[0], targetPos[0]) - xo,
        		y = Math.min(sourcePos[1], targetPos[1]) - yo;            
		
			if (sourceEndpoint.elementId != targetEndpoint.elementId) {
                            
                isLoopback = false;
                            
        		_sx = sourcePos[0] < targetPos[0] ?  xo : w-xo;
            	_sy = sourcePos[1] < targetPos[1] ? yo:h-yo;
            	_tx = sourcePos[0] < targetPos[0] ? w-xo : xo;
            	_ty = sourcePos[1] < targetPos[1] ? h-yo : yo;
            
            	// now adjust for the margin
            	if (sourcePos[2] == 0) _sx -= margin;
            	if (sourcePos[2] == 1) _sx += margin;
            	if (sourcePos[3] == 0) _sy -= margin;
            	if (sourcePos[3] == 1) _sy += margin;
            	if (targetPos[2] == 0) _tx -= margin;
            	if (targetPos[2] == 1) _tx += margin;
            	if (targetPos[3] == 0) _ty -= margin;
            	if (targetPos[3] == 1) _ty += margin;

            	//
	            // these connectors are quadratic bezier curves, having a single control point. if both anchors 
    	        // are located at 0.5 on their respective faces, the control point is set to the midpoint and you
        	    // get a straight line.  this is also the case if the two anchors are within 'proximityLimit', since
           	 	// it seems to make good aesthetic sense to do that. outside of that, the control point is positioned 
           	 	// at 'curviness' pixels away along the normal to the straight line connecting the two anchors.
	            // 
   	        	// there may be two improvements to this.  firstly, we might actually support the notion of avoiding nodes
            	// in the UI, or at least making a good effort at doing so.  if a connection would pass underneath some node,
            	// for example, we might increase the distance the control point is away from the midpoint in a bid to
            	// steer it around that node.  this will work within limits, but i think those limits would also be the likely
            	// limits for, once again, aesthetic good sense in the layout of a chart using these connectors.
            	//
            	// the second possible change is actually two possible changes: firstly, it is possible we should gradually
            	// decrease the 'curviness' as the distance between the anchors decreases; start tailing it off to 0 at some
            	// point (which should be configurable).  secondly, we might slightly increase the 'curviness' for connectors
            	// with respect to how far their anchor is from the center of its respective face. this could either look cool,
            	// or stupid, and may indeed only work in a way that is so subtle as to have been a waste of time.
            	//

				var _segment = function(x1, y1, x2, y2) {
					if (x1 <= x2 && y2 <= y1) return 1;
					else if (x1 <= x2 && y1 <= y2) return 2;
					else if (x2 <= x1 && y2 >= y1) return 3;
					return 4;
				},
				_multzBySegment = function(seg, sPos, tPos) {
					if (seg == 1) {
						if (sPos[3] == 0 && tPos[2] == 0) return [-1,-1]; // top + left
						else if (sPos[3] == 0 && tPos[3] == 1) return [1,0];
						else if (sPos[2] == 1 && tPos[2] == 0) return [0,-1];
						else return [1,1];						
					}
					else if (seg == 2) {
						if (sPos[2] == 1 && tPos[3] == 0) return [1, -1];
						else if (sPos[2] == 1 && tPos[2] == 0) return [-1, 1];
						else if (sPos[3] == 1 && tPos[3] == 0) return [1, -1];
						else return [-1,1];
					}
					else if (seg == 3) {
						if (sPos[3] == 1 && tPos[3]== 0) return [-1,-1];
						else if (sPos[2] == 0 && tPos[3] == 0) return [-1,0];
						else if (sPos[2] == 0 && tPos[2] == 1) return [1,1];
						else return [1,-1];
					}
					else if (seg == 4) {
						if (sPos[2] == 0 && tPos[2] == 1) return [1,-1];
						else if (sPos[3] == 0 && tPos[2] == 1) return [1,-1];
						else if (sPos[3] == 0 && tPos[3] == 1) return [-1,1];
					}
					return [0,0];
				},
            	_midx = (_sx + _tx) / 2, _midy = (_sy + _ty) / 2, 
            	m2 = (-1 * _midx) / _midy, theta2 = Math.atan(m2),            
            	dy =  (m2 == Infinity || m2 == -Infinity) ? 0 : Math.abs(curviness / 2 * Math.sin(theta2)),
				dx =  (m2 == Infinity || m2 == -Infinity) ? 0 : Math.abs(curviness / 2 * Math.cos(theta2)),
				segment = _segment(_sx, _sy, _tx, _ty),			
				multz = _multzBySegment(segment, sourcePos, targetPos),
				distance = Math.sqrt(Math.pow(_tx - _sx, 2) + Math.pow(_ty - _sy, 2));					
			
            	// calculate the control point.  this code will be where we'll put in a rudimentary element avoidance scheme; it
            	// will work by extending the control point to force the curve to be, um, curvier.
				_controlX = _midx + ((distance > proximityLimit) ? (multz[0] * dx) : 0);
				_controlY = _midy + ((distance > proximityLimit) ? (multz[1] * dy) : 0);				

			/*	console.log("segment", segment, "sourcePos", 
				sourcePos[2], sourcePos[3], "source ep", sourceEndpoint.id,
				"midx",_midx,"midy",_midy,
				"m2",m2,
				"theta2", theta2,
				"dx",dx,
				"dy",dy,
				"cx", _controlX, "cy", _controlY);
				*/
				// now for a rudimentary avoidance scheme. TODO: how to set this in a cross-library way?  
		//		var testLine = new Line(sourcePos[0] + _sx,sourcePos[1] + _sy,sourcePos[0] + _tx,sourcePos[1] + _ty);
		//		var sel = $(".w");
		//		sel.each(function(i,e) {
		//			var id = jsPlumb.getId(e);
		//			if (id != sourceEndpoint.elementId && id != targetEndpoint.elementId) {
		//				o = jsPlumb.getOffset(id), s = jsPlumb.getSize(id);
//
//						if (o && s) {
//							var collision = testLine.rectIntersect(o.left,o.top,s[0],s[1]);
//							if (collision) {
								// set the control point to be a certain distance from the midpoint of the two points that
								// the line crosses on the rectangle.
								// TODO where will this 75 number come from?
					//			_controlX = collision[2][0] + (75 * collision[3][0]);
				//	/			_controlY = collision[2][1] + (75 * collision[3][1]);							
//							}
//						}/
					//}
	//			});
	            	
            	var requiredWidth = Math.max(Math.abs(_controlX - _sx) * 3, Math.abs(_controlX - _tx) * 3, Math.abs(_tx-_sx), 2 * lineWidth, minWidth),
            		requiredHeight = Math.max(Math.abs(_controlY - _sy) * 3, Math.abs(_controlY - _ty) * 3, Math.abs(_ty-_sy), 2 * lineWidth, minWidth);
            		
            	if (w < requiredWidth) {      	
            		var dw = requiredWidth - w;            		
            		x -= (dw / 2);
            		_sx += (dw / 2);
            		_tx  += (dw / 2);
            		w = requiredWidth;
            	}
            	
            	if (h < requiredHeight) {
            		var dh = requiredHeight - h;
            		y -= (dh / 2);
            		_sy += (dh / 2);
            		_ty += (dh / 2);
            		h = requiredHeight;
            	}
            	currentPoints = [ x, y, w, h, _sx, _sy, _tx, _ty, _controlX, _controlY ];                                        
            }
            else {
            	isLoopback = true;
            	// a loopback connector.  draw an arc from one anchor to the other.
            	// i guess we'll do this the same way as the others.  just the control point will be a fair distance away.
        		var x1 = sourcePos[0], x2 = sourcePos[0], y1 = sourcePos[1] - margin, y2 = sourcePos[1] - margin, 
				r = 25,//  TODO SHOULD BE COMPUTED SOMEHOW 
				cx = x1, cy = y1 - r;
				
				// now we need the angle from the center to each point.  the arc will start at the first angle and go to the second.
				var m1 = (cy - y1) / (cx - x1), theta1 = Math.atan(m1), m2 = (cy - y2) / (cx - x2), theta2 = Math.atan(m2);
				
				// canvas sizing stuff, to ensure the whole painted area is visible.
				w = ((2 * lineWidth) + (4 * r)), h = ((2 * lineWidth) + (4 * r));
				x = cx - r - lineWidth - r, y = cy - r - lineWidth - r;
				currentPoints = [ x, y, w, h, cx-x, cy-y, r, clockwise, x1-x, y1-y, x2-x, y2-y];
            }
                
            return currentPoints;
        };
        
        var _makeCurve = function() {
        	return [	
	        	{ x:_tx, y:_ty },
	        	{ x:_controlX, y:_controlY },
	        	{ x:_controlX + 1, y:_controlY + 1},	        	
	        	{ x:_sx, y:_sy }
         	];
        };     
        
        /**
         * returns the point on the connector's path that is 'location' along the length of the path, where 'location' is a decimal from
         * 0 to 1 inclusive. for the straight line connector this is simple maths.  for Bezier, not so much.
         */
        this.pointOnPath = function(location) {   
			if (isLoopback) {
				
// current points are [ x, y, width, height, center x, center y, radius, clockwise, startx, starty, endx, endy ]				
				// so the path length is the circumference of the circle
				//var len = 2 * Math.PI * currentPoints[6],
				// map 'location' to an angle. 0 is PI/2 when the connector is on the top face; if we
				// support other faces it will have to be calculated for each one. 1 is also PI/2.
				// 0.5 is -PI/2.
				var startAngle = (location * 2 * Math.PI) + (Math.PI / 2),
					startX = currentPoints[4] + (currentPoints[6] * Math.cos(startAngle)),
					startY = currentPoints[5] + (currentPoints[6] * Math.sin(startAngle));					
	//console.log("loopback point along path from",location,startAngle, startX, startY, currentPoints[4], currentPoints[5], currentPoints[6]);    
				
				return { x:currentPoints[8], y:currentPoints[9] };
					
			}
        	else return jsBezier.pointOnCurve(_makeCurve(), location);
        };
        
        /**
         * returns the gradient of the connector at the given point.
         */
        this.gradientAtPoint = function(location) {
			if (isLoopback) {
	//			console.log("loopback gradient at point", location);        
				return Math.atan(location * 2 * Math.PI);
			}
        	else return jsBezier.gradientAtPoint(_makeCurve(), location);        	
        };	
        
        /**
         * returns the gradient of the connector at the point which is distance from location.
         */
        this.gradientAtPointAlongPathFrom = function(location, distance) {
			if (isLoopback) {
	//			console.log("loopback gradient at point along path from",location,distance);        
				return 1;
			}
        	else return jsBezier.gradientAtPointAlongCurveFrom(_makeCurve(), location, distance);        	
        };	
        
        /**
         * for Bezier curves this method is a little tricky, cos calculating path distance algebraically is notoriously difficult.
         * this method is iterative, jumping forward .05% of the path at a time and summing the distance between this point and the previous
         * one, until the sum reaches 'distance'. the method may turn out to be computationally expensive; we'll see.
         * another drawback of this method is that if the connector gets quite long, .05% of the length of it is not necessarily smaller
         * than the desired distance, in which case the loop returns immediately and the arrow is mis-shapen. so a better strategy might be to
         * calculate the step as a function of distance/distance between endpoints.  
         */
         // TODO we shouldn't need this method.  it's for overlays, but it has become apparent that an overlay
         // should assume the head point's gradient for its entirety, or things look weird.
         // or perhaps certain overlays want to support it and others do not.  the Arrow overlay, for
         // example, probably does not.
        this.pointAlongPathFrom = function(location, distance) {        	
			if (isLoopback) {
			
				var circumference = 2 * Math.PI * currentPoints[6],
					arcSpan = distance / circumference * 2 * Math.PI,
					startAngle = (location * 2 * Math.PI) - arcSpan + (Math.PI / 2),	
					
					startX = currentPoints[4] + (currentPoints[6] * Math.cos(startAngle)),
					startY = currentPoints[5] + (currentPoints[6] * Math.sin(startAngle));	
					
				//var diff = distance < 0 ? -5 : 5;
//				return {x:currentPoints[8] - diff, y:currentPoints[9] - diff };
//	console.log("loopback point along path from",location,distance, startAngle, startX, startY, currentPoints[4], currentPoints[5]);    
				return {x:startX, y:startY};
			}
        	return jsBezier.pointAlongCurveFrom(_makeCurve(), location, distance);
        };        
        
        /**
         * calculates a line that is perpendicular to, and centered on, the path at 'distance' pixels from the given location.
         * the line is 'length' pixels long.
         */
        this.perpendicularToPathAt = function(location, length, distance) {    
        	if (isLoopback) {
				
				var g = self.gradientAtPoint(location),
					theta2 = Math.atan(-1 / g),
				
				//var theta2 = -1 / Math.atan(((location * 2 * Math.PI) + (Math.PI / 2))),
					xy = self.pointAlongPathFrom(location, distance),
					p1 = {
						x: xy.x + ((length / 2) * Math.cos(theta2)),
						y: xy.y + ((length / 2) * Math.sin(theta2))
					},
					p2 = {
						x: xy.x - ((length / 2) * Math.cos(theta2)),
						y: xy.y - ((length / 2) * Math.sin(theta2))
					};					
					
		//		console.log("loopback perpendicular to path at",location,length,distance, p1, p2, xy);
				
				return [p1, p2];
				//return [ {x:xy.x, y:xy.y - 10}, {x:xy.x, y:xy.y + 10}];
			}
        	return jsBezier.perpendicularToCurveAt(_makeCurve(), location, length, distance);
        };
	
	
	};
	
	/*
     * Canvas state machine renderer. 
     */
    jsPlumb.Connectors.canvas.StateMachine = function(params) {   	 
    	params = params || {};
		var self = this, drawGuideline = params.drawGuideline || true, avoidSelector = params.avoidSelector;
		jsPlumb.Connectors.StateMachine.apply(this, arguments);
		jsPlumb.CanvasConnector.apply(this, arguments);
	
		
		this._paint = function(dimensions) {
			
			if (dimensions.length == 10) {
		        self.ctx.beginPath();
				self.ctx.moveTo(dimensions[4], dimensions[5]);
				self.ctx.quadraticCurveTo(dimensions[8], dimensions[9], dimensions[6], dimensions[7]);
				self.ctx.stroke();            
				
				// draw the guideline
				if (drawGuideline) {
					self.ctx.save();
					self.ctx.beginPath();
					self.ctx.strokeStyle = "silver";
					self.ctx.lineWidth = 1;
					self.ctx.moveTo(dimensions[4], dimensions[5]);
					self.ctx.lineTo(dimensions[6], dimensions[7]);
					self.ctx.stroke();            
					self.ctx.restore();
				}
			}
			else {
				// a loopback connector
				self.ctx.save();
				self.ctx.beginPath();        	
	        	var startAngle = 0,                     // Starting point on circle
	        	endAngle   = 2 * Math.PI, // End point on circle
	        	clockwise  = dimensions[7]; // clockwise or anticlockwise 
	        	self.ctx.arc(dimensions[4],dimensions[5],dimensions[6],0, endAngle, clockwise);
				self.ctx.stroke();
				self.ctx.closePath();
				self.ctx.restore();
			}
	    };	    
	    
	    this.createGradient = function(dim, ctx) {
        	return ctx.createLinearGradient(dim[4], dim[5], dim[6], dim[7]);
        };
    };
    
    /*
     * SVG State Machine renderer
     */
    jsPlumb.Connectors.svg.StateMachine = function() {   	 
		var self = this;
		jsPlumb.Connectors.StateMachine.apply(this, arguments);
		jsPlumb.SvgConnector.apply(this, arguments);
		this.getPath = function(d) { 	
				
			if (d.length == 10) 
				return "M " + d[4] + " " + d[5] + " C " + d[8] + " " + d[9] + " " + d[8] + " " + d[9] + " " + d[6] + " " + d[7]; 
			else {
				// loopback
				return "M" + (d[8] + 4) + " " + d[9] + " A " + d[6] + " " + d[6] + " 0 1,0 " + (d[8]-4) + " " + d[9];			
			}
		};	    	    
    };
    
    /*
     * VML state machine renderer
     */
    jsPlumb.Connectors.vml.StateMachine = function() {
		jsPlumb.Connectors.StateMachine.apply(this, arguments);	
		jsPlumb.VmlConnector.apply(this, arguments);
		var _conv = jsPlumb.vml.convertValue;
		this.getPath = function(d) {	
			if (d.length == 10) {
				return "m" + _conv(d[4]) + "," + _conv(d[5]) + 
					   " c" + _conv(d[8]) + "," + _conv(d[9]) + "," + _conv(d[8]) + "," + _conv(d[9]) + "," + _conv(d[6]) + "," + _conv(d[7]) + " e";
			}
			else {
				// loopback
				var l = d[4] - d[6], t = d[5] - d[6], r = d[4] + d[6], b = d[4] + d[6];
				return "m" + _conv(d[8]) + "," + _conv(d[9]) +
				" ar " + l + "," + t + "," + r + "," + b + "," + d[8] + "," + d[9] + "," + d[10] + "," + d[11] + " e";
			}
		};
	};

})();