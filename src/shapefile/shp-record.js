/* @requires shp-type */

// Returns a constructor function for a shape record class with
//   properties and methods for reading coordinate data.
//
// Record properties
//   type, isNull, byteLength, pointCount, partCount (all types)
//
// Record methods
//   read(), readPoints() (all types)
//   readBounds(), readCoords()  (all but single point types)
//   readPartSizes() (polygon and polyline types)
//   readZBounds(), readZ() (Z types except POINTZ)
//   readMBounds(), readM(), hasM() (M and Z types, except POINT[MZ])
//
function ShpRecordClass(type) {
  var hasBounds = ShpType.hasBounds(type),
      hasParts = ShpType.isMultiPartType(type),
      hasZ = ShpType.isZType(type),
      hasM = ShpType.isMType(type),
      singlePoint = !hasBounds,
      mzRangeBytes = singlePoint ? 0 : 16;

  // @bin is a BinArray set to the first byte of a shape record
  var constructor = function ShapeRecord(bin) {
    var pos = bin.position();
    this.id = bin.bigEndian().readUint32();
    this.byteLength = bin.readUint32() * 2 + 8; // bytes in content section + 8 header bytes
    this.type = bin.littleEndian().readUint32();
    this.isNull = this.type === 0;
    if (this.byteLength <= 0 || this.type !== 0 && this.type != type)
      error("Unable to read a shape -- .shp file may be corrupted");

    if (this.isNull) {
      this.pointCount = 0;
      this.partCount = 0;
    } else if (singlePoint) {
      this.pointCount = 1;
      this.partCount = 1;
    } else {
      bin.skipBytes(32); // skip bbox
      this.partCount = hasParts ? bin.readUint32() : 1;
      this.pointCount = bin.readUint32();
    }
    this._data = function() {
      return this.isNull ? null : bin.position(pos);
    };
  };

  // base prototype has methods shared by all Shapefile types except NULL type
  // (Type-specific methods are mixed in below)
  var proto = {
    // return offset of [x, y] point data in the record
    _xypos: function() {
      var offs = 12; // skip header & record type
      if (!singlePoint) offs += 4; // skip point count
      if (hasBounds) offs += 32;
      if (hasParts) offs += 4 * this.partCount + 4; // skip part count & index
      return offs;
    },

    readCoords: function() {
      if (this.pointCount === 0) return null;
      var partSizes = this.readPartSizes(),
          xy = this._data().skipBytes(this._xypos());

      return partSizes.map(function(pointCount) {
        return xy.readFloat64Array(pointCount * 2);
      });
    },

    readXY: function() {
      if (this.pointCount === 0) return null;
      return this._data().skipBytes(this._xypos()).readFloat64Array(this.pointCount * 2);
    },

    readPoints: function() {
      var xy = this.readXY(),
          zz = hasZ ? this.readZ() : null,
          mm = hasM && this.hasM() ? this.readM() : null,
          points = [], p;

      for (var i=0, n=xy.length / 2; i<n; i++) {
        p = [xy[i*2], xy[i*2+1]];
        if (zz) p.push(zz[i]);
        if (mm) p.push(mm[i]);
        points.push(p);
      }
      return points;
    },

    read: function() {
      return this.readPoints();
    },

    readPartSizes: function() {
      if (this.pointCount === 0) return null;
      if (this.partCount == 1) return [this.pointCount];
      var partLen,
          startId = 0,
          sizes = [],
          bin = this._data().skipBytes(56); // skip to second entry in part index
      for (var i=0, n=this.partCount; i<n; i++) {
        if (i < n - 1)
          partLen = bin.readUint32() - startId;
        else
          partLen = this.pointCount - startId;

        if (partLen <= 0) error("ShapeRecord#readPartSizes() corrupted part");
        sizes.push(partLen);
        startId += partLen;
      }
      return sizes;
    }
  };

  var singlePointProto = {
    read: function() {
      var n = 2;
      if (hasZ) n++;
      if (this.hasM()) n++;
      return this._data().skipBytes(12).readFloat64Array(n);
    }
  };

  var multiCoordProto = {
    readBounds: function() {
      return this._data().skipBytes(12).readFloat64Array(4);
    },

    read: function() {
      var points = this.readPoints();
      var parts = this.readPartSizes().map(function(size) {
          return points.splice(0, size);
        });
      return parts;
    }
  };

  var mProto = {
    _mpos: function() {
      var pos = this._xypos() + this.pointCount * 16;
      if (hasZ) {
        pos += this.pointCount * 8 + mzRangeBytes;
      }
      return pos;
    },

    readMBounds: function() {
      return this.hasM() ? this._data().skipBytes(this._mpos()).readFloat64Array(2) : null;
    },

    // TODO: group into parts, like readCoords()
    readM: function() {
      return this.hasM() ? this._data().skipBytes(this._mpos() + mzRangeBytes).readFloat64Array(this.pointCount) : null;
    },

    // Test if this record contains M data
    // (according to the Shapefile spec, M data is optional in a record)
    //
    hasM: function() {
      var bytesWithoutM = this._mpos(),
          bytesWithM = bytesWithoutM + this.pointCount * 8 + mzRangeBytes;
      if (this.byteLength == bytesWithoutM) {
        return false;
      } else if (this.byteLength == bytesWithM) {
        return true;
      } else {
        error("#hasM() Counting error");
      }
    }
  };

  var zProto = {
    _zpos: function() {
      return this._xypos() + this.pointCount * 16;
    },

    readZBounds: function() {
      return this._data().skipBytes(this._zpos()).readFloat64Array(2);
    },

    // TODO: group into parts, like readCoords()
    readZ: function() {
      return this._data().skipBytes(this._zpos() + mzRangeBytes).readFloat64Array(this.pointCount);
    }
  };

  if (singlePoint) {
    utils.extend(proto, singlePointProto);
  } else {
    utils.extend(proto, multiCoordProto);
  }
  if (hasZ) utils.extend(proto, zProto);
  if (hasM) utils.extend(proto, mProto);

  constructor.prototype = proto;
  proto.constructor = constructor;
  return constructor;
}
