"use strict"

Number.prototype.mod = function (n) {
	return ((this % n) + n) % n;
};

Number.prototype.magneticCourseAndDeviation = function (devTable) {
	let cc = this.mod(360.0);
	for (var i = 0; i < 37; i++) {
	if ((cc >= i * 10) && (cc < (i + 1) * 10))
	  break
	}
	let cc1 = i * 10;
	let cc2 = (i + 1) * 10;
	let d1 = devTable[i];
	let d2 = devTable[i + 1];
	let deviation = d1 + (d2 - d1) * (cc - cc1) / (cc2 - cc1);
	return [(cc + deviation).mod(360.0), deviation];
}

Number.prototype.compassCourseAndDeviation = function (devTable) {
	let mc = this.mod(360.0);
	for (var i = 0; i < 37; i++) {
	if ((mc >= i * 10 + devTable[i]) && (mc < (i + 1) * 10 + devTable[i + 1])) {
	  break;
	}
	}
	let cc1 = i * 10;
	let cc2 = (i + 1) * 10;
	let mc1 = cc1 + devTable[i];
	let mc2 = cc2 + devTable[i + 1];
	let compassCourse = (cc1 + (cc2 - cc1) * (mc - mc1) / (mc2 - mc1)).mod(360.0);
	let deviation = compassCourse.magneticCourseAndDeviation(devTable)[1];
	return [compassCourse, deviation];
}

function degrees2DM(degrees) {
	let degs = new Number(degrees).mod(360.0);
	return [Math.floor(degs), 60 * (degs - Math.floor(degs))];
}

function dm2Degrees(degrees, minutes) {
	return new Number(degrees + minutes / 60.0).mod(360.0);
}

Number.prototype.toDM = function () {
	return [Math.floor(this).toFixed(0), (60 * (this - Math.floor(this))).toFixed(2)]
}

Number.prototype.toDMText = function () {
	let deg = Math.floor(this).toFixed(0).toString()+ "°";
	let min = (60 * (this - Math.floor(this))).toFixed(2).toString() + "′";
	if (min.length == 5) {
		min = "0" + min;
	}
	return deg + min;
}

Array.prototype.toDegrees = function () {
	return this[0] + this[1] / 60.0;
}

function alpha(trueCourse, windDirection) {
	let difference = (windDirection - trueCourse).mod(360);
	if ((0 <= difference) && (difference < 80)) {
		return -8;
	} else if ((80 <= difference) && (difference < 100)) {
		return -4;
	} else if ((100 <= difference) && (difference < 170)) {
		return -2;
	} else if ((170 <= difference) && (difference < 190)) {
		return 0;
	} else if ((190 <= difference) && (difference < 260)) {
		return 2;
	} else if ((260 <= difference) && (difference < 280)) {
		return 4;
	} else { // if ((280<=difference) && (difference < 360))
		return 8;
	}
}

Number.prototype.toRadians = function () {
	return this * Math.PI / 180.0;
}

Number.prototype.toDegrees = function () {
	return this * 180.0 / Math.PI;
}

Array.prototype.vectorAdd = function (other) {
	var result = [];
	for (var i = 0; i < this.length; i++) {
		result.push(this[i] + other[i]);
	}
	return result;
}

Array.prototype.vectorSub = function (other) {
	var result = [];
	for (var i = 0; i < this.length; i++) {
		result.push(this[i] - other[i]);
	}
	return result;
}

Array.prototype.numberMul = function (a) {
	var result = [];
	for (var i = 0; i < this.length; i++) {
		result.push(this[i] * a);
	}
	return result;
}

Array.prototype.scalarMul = function (other) {
	var result = 0;
	for (var i = 0; i < this.length; i++) {
		result += this[i] * other[i];
	}
	return result;
}

Array.prototype.norm = function () {
	return Math.sqrt(this.scalarMul(this));
}

Array.prototype.vector2Mul = function (other) {
	return this[0] * other[1] - this[1] * other[0];
}

Array.prototype.angle = function (other) {
	// Prevent acos from arguments which are greater than 1 due to rounding errors
	let angle = Math.acos((this.scalarMul(other) / this.norm() / other.norm()).toFixed(12));
	if (this.vector2Mul(other) < 0) {
		angle = -angle;
	}
	return angle;
}

function directProblem(declination, lat, long, compassCourse, boatVelocity, logIncrement,
		windDirection, streamVelocity, streamDirection, useWind, useStream, devTable) {
	let [magneticCourse, deviation] = compassCourse.magneticCourseAndDeviation(devTable);
	let trueCourse = magneticCourse + declination;
	let alph = useWind ? alpha(trueCourse, windDirection) : 0;
	let cts = trueCourse + alph;
	let wayOverWater = [Math.cos(cts.toRadians()), Math.sin(cts.toRadians())]
		.numberMul(logIncrement);
	let stream = useStream? [Math.cos(streamDirection.toRadians()), Math.sin(streamDirection.toRadians())]
		.numberMul(logIncrement * streamVelocity / boatVelocity) : [0, 0];
	let wayOverGround = wayOverWater.vectorAdd(stream);
	let newLat = lat + wayOverGround[0] / 60;
	let newLong = long + wayOverGround[1] / 60 / Math.cos(((lat + newLat) / 2).toRadians());
	let beta = useStream? wayOverWater.angle(wayOverGround).toDegrees() : 0;
	let cog = cts + beta;

	return [newLat, newLong, deviation, magneticCourse.mod(360.0), trueCourse.mod(360.0), alph, cts.mod(360.0), beta, cog.mod(360.0)];
}

function inverseProblem1(declination, lat, long, cog, boatVelocity, logIncrement,
		windDirection, streamVelocity, streamDirection, useWind, useStream, devTable) {
	let unitVecOverGround = [Math.cos(cog.toRadians()), Math.sin(cog.toRadians())];
	let unitStream = [Math.cos(streamDirection.toRadians()), Math.sin(streamDirection.toRadians())];
	
	if (!useStream) {
		streamVelocity = 0;
	}
	let stream = unitStream.numberMul(streamVelocity);
	let psi = unitStream.angle(unitVecOverGround);
	let [wcospsi, wsinpsi] = [Math.cos(psi), Math.sin(psi)].numberMul(streamVelocity);
	let velocityOverGround = wcospsi + Math.sqrt(boatVelocity * boatVelocity - wsinpsi * wsinpsi);

	let lineOverGround = unitVecOverGround.numberMul(velocityOverGround);
	let lineOverWater = lineOverGround.vectorSub(stream);
	let wayOverWater = lineOverWater.numberMul(logIncrement / lineOverWater.norm());
	let wayOverGround = wayOverWater.vectorAdd(stream.numberMul(logIncrement / lineOverWater.norm()));
	let newLat = lat + wayOverGround[0] / 60;
	let newLong = long + wayOverGround[1] / 60 / Math.cos(((lat + newLat) / 2).toRadians());
	let beta = lineOverWater.angle(lineOverGround).toDegrees();
	let cts = cog - beta;

	//// Not exactly!
	let alph = useWind ? alpha(cts, windDirection) : 0;

	let trueCourse = cts - alph;
	let magneticCourse = trueCourse - declination;
	let [compassCourse, deviation] = magneticCourse.compassCourseAndDeviation(devTable);

	return [newLat, newLong, compassCourse.mod(360.0), deviation, magneticCourse.mod(360.0), trueCourse.mod(360.0), alph, cts, beta];
}

function inverseProblem2(declination, lat, long, newLat, newLong, boatVelocity, 
		windDirection, streamVelocity, streamDirection, useWind, useStream, devTable) {
	let wayOverGround = [newLat - lat, (newLong - long) * Math.cos(((lat + newLat) / 2).toRadians())].numberMul(60.0);
	let unitVecOverGround = wayOverGround.numberMul(1 / wayOverGround.norm());
	let cog = [1, 0].angle(unitVecOverGround).toDegrees();
	let unitStream = [Math.cos(streamDirection.toRadians()), Math.sin(streamDirection.toRadians())];
	
	if (!useStream) {
		streamVelocity = 0;
	}

	let stream = unitStream.numberMul(streamVelocity);
	let psi = unitStream.angle(unitVecOverGround);
	let [wcospsi, wsinpsi] = [Math.cos(psi), Math.sin(psi)].numberMul(streamVelocity);
	let velocityOverGround = wcospsi + Math.sqrt(Math.abs(boatVelocity * boatVelocity - wsinpsi * wsinpsi));

	let logIncrement = wayOverGround.norm() * boatVelocity / velocityOverGround;
	let lineOverGround = unitVecOverGround.numberMul(velocityOverGround);
	let lineOverWater = lineOverGround.vectorSub(stream);
	let wayOverWater = lineOverWater.numberMul(logIncrement / lineOverWater.norm());
	let beta = lineOverWater.angle(lineOverGround).toDegrees();
	let cts = cog - beta;

	//// Not exactly!
	let alph = useWind ? alpha(cts, windDirection) : 0;

	let trueCourse = cts - alph;
	let magneticCourse = trueCourse - declination;
	let [compassCourse, deviation] = magneticCourse.compassCourseAndDeviation(devTable);

	return [compassCourse.mod(360.0), deviation, magneticCourse.mod(360.0), trueCourse.mod(360.0), alph, cts.mod(360.0), beta, cog.mod(360.0), logIncrement];
}

