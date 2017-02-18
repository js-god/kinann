var should = require("should");
var mathjs = require("mathjs");
var Optimizer = require("./Optimizer");

(function(exports) {
    ////////////////// constructor
    MapLayer = function(fmap, options = {}) {
        var that = this;
        that.id = options.id || 0;
        that.nOut = fmap.length;
        that.fmap = fmap;
        return that;
    }
    MapLayer.prototype.toJSON = function() {
        var that = this;
        return JSON.stringify({
            type: "MapLayer",
            id: that.id,
            fmap: that.fmap.map((f) => f.toString()),
        });
    }
    MapLayer.fromJSON = function(json) {
        var obj = JSON.parse(json);
        if (obj.type !== "MapLayer") {
            return null;
        }
        var fmap = obj.fmap.map((f) => (new Function("return " + f))());
        //var fun = JSON.parse(json).map((f) => (new Function("return " + f))());
        return new MapLayer(fmap, {
            id: obj.id,
        });
    }
    MapLayer.prototype.initialize = function(nIn, weights = {}, options = {}) {
        var that = this;
        return weights;
    };
    MapLayer.prototype.expressions = function(exprIn) {
        var that = this;
        if (!exprIn instanceof Array) {
            throw new Error("Expected input expression vector");
        }
        return that.fmap.map((f, i) => f(exprIn));
    }
    MapLayer.validateStats = function(stats = {}) {
        var min = stats.min == null ? -1 : stats.min;
        var max = stats.max == null ? 1 : stats.max;
        return {
            min: min,
            max: max,
            mean: stats.mean == null ? ((min + max) / 2) : stats.mean,
            std: stats.std == null ? ((max - min) / mathjs.sqrt(12)) : stats.std,
        }
    }
    MapLayer.mapExpr = function(n, statsIn, statsOut, fun = "mapidentity") {
        (statsIn instanceof Array) || (statsIn = Array(n).fill(statsIn || {}));
        (statsOut instanceof Array) || (statsOut = Array(n).fill(statsOut || {}));
        var si = statsIn.map((s) => MapLayer.validateStats(s));
        var so = statsOut.map((s) => MapLayer.validateStats(s));
        var mapFun = fun;
        if (typeof mapFun === "string") {
            mapFun = fun.indexOf("map") === 0 && MapLayer[fun.toUpperCase()];
            if (!mapFun) {
                throw new Error("mapFun() unknown mapping function:" + fun);
            }
        }
        if (typeof mapFun !== "function") {
            throw new Error("mapFun(,,,?) expected mapping function");
        }
        return statsIn.map((f, i) => new Function("eIn", "return " + '"' + mapFun(si[i], so[i], '("+eIn[' + i + ']+")') + '"'));
    }
    MapLayer.mapFun = function(n, statsIn, statsOut, fun = "mapidentity") {
        (statsIn instanceof Array) || (statsIn = Array(n).fill(statsIn || {}));
        (statsOut instanceof Array) || (statsOut = Array(n).fill(statsOut || {}));
        var si = statsIn.map((s) => MapLayer.validateStats(s));
        var so = statsOut.map((s) => MapLayer.validateStats(s));
        var mapFun = fun;
        if (typeof mapFun === "string") {
            mapFun = fun.indexOf("map") === 0 && MapLayer[fun.toUpperCase()];
            if (!mapFun) {
                throw new Error("mapFun() unknown mapping function:" + fun);
            }
        }
        if (typeof mapFun !== "function") {
            throw new Error("mapFun(,,,?) expected mapping function");
        }
        return statsIn.map((f, i) => new Function("x", "return " + mapFun(si[i], so[i], "x")));
    }
    MapLayer.MAPIDENTITY = function(si, so, x) {
        return x;
    }
    MapLayer.MAPSTD = function(si, so, x) {
        var scale = so.std / si.std;
        var body = si.mean ? "(" + x + " - " + si.mean + ")" : x;
        scale != 1 && (body += "*" + scale);
        so.mean && (body += "+" + so.mean);
        return body;
    }
    MapLayer.MAPMINMAX = function(si, so, x) {
        var dsi = si.max - si.min;
        var dso = so.max - so.min;
        var simean = (si.max + si.min) / 2;
        var somean = (so.max + so.min) / 2;
        var scale = dsi ? dso / dsi : 1;
        var body = simean ? "(" + x + " - " + simean + ")" : x;
        scale != 1 && (body += "*" + scale);
        somean && (body += "+" + somean);
        return body;
    }

    module.exports = exports.MapLayer = MapLayer;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Learn", function() {
    var MapLayer = exports.MapLayer; // require("./MapLayer");
    var UNISTD = 0.5773502691896258; // standard deviation of [-1,1]
    var logistic_opts = {
        activation: "logistic"
    };
    var identity_opts = {
        activation: "identity",
        id: 1,
    };

    function assertRandom(weights, variance) {
        var wkeys = Object.keys(weights);
        var w = [];
        for (var iw = 0; iw < wkeys.length; iw++) {
            w.push(weights[wkeys[iw]]);
        }
        w = w.sort();
        for (var iw = 0; iw < wkeys.length - 1; iw++) {
            w[iw].should.not.equal(w[iw + 1]);
            w[iw].should.not.equal(0);
            (typeof w[iw]).should.equal("number");
        }
        mathjs.var(w).should.below(variance);
        mathjs.var(w).should.above(0);
    }
    it("MapLayer(fmap) creates an unweighted mapping layer", function() {
        var map = new MapLayer([
            (eIn) => eIn[0],
            (eIn) => eIn[1],
            (eIn) => "((" + eIn[0] + ")^2)",
            (eIn) => "((" + eIn[1] + ")^2)",
        ]);
        should.deepEqual(map.expressions(["x0", "x1", "x2"]), [
            "x0",
            "x1",
            "((x0)^2)",
            "((x1)^2)",
        ]);
        map.nOut.should.equal(4);
    });
    it("Layer can be serialized", function() {
        var layer = new Layer(3, {
            id: 5,
            activation: "logistic",
        });

        var json = layer.toJSON(); // serialize layer
        var layer2 = Layer.fromJSON(json); // deserialize layer

        layer2.id.should.equal(5);
        var eIn = ["x0", "x1"];
        should.deepEqual(layer2.expressions(eIn), layer.expressions(eIn));
    })
    it("MapLayer can be serialized", function() {
        var layer = new MapLayer([
            (eIn) => eIn[0],
            (eIn) => "(" + eIn[0] + "^2)",
        ], {
            id: 3
        });

        var json = layer.toJSON(); // serialize layer
        var layer2 = MapLayer.fromJSON(json); // deserialize layer

        layer2.id.should.equal(3);
        var eIn = ["x0", "x1"];
        should.deepEqual(layer2.expressions(eIn), layer.expressions(eIn));
    })
    it("MapLayer.validateStats(stats) applies statistic defaults", function() {
        var normStats = MapLayer.validateStats();
        should.deepEqual(normStats, {
            max: 1,
            min: -1,
            mean: 0,
            std: UNISTD,
        });
        should.deepEqual(normStats, MapLayer.validateStats(normStats));

        should.deepEqual(MapLayer.validateStats({
            min: 0,
            max: 4
        }), {
            max: 4,
            min: 0,
            mean: 2,
            std: 2 * UNISTD,
        });
    })
    it("MapLayer.mapFun(n,statsIn,statsOut,'mapStd') creates normalization function vector", function() {
        var stats = [{
            min: 0,
            max: 200,
            std: 10 * UNISTD, // narrow distribution
        }, {
            min: -10,
            max: -5,
            std: 5 * UNISTD, // wide distribution
        }];

        // CAUTION: mapStd is not recommended for kinematic normalization,
        // since it is difficult to match up input and output ranges.
        // Since kinematic motion is normally restricted to clearly defined ranges,
        // mapMinMax is preferred for normalization.
        var fun = MapLayer.mapFun(2, stats, null, 'mapStd');

        // narrow input distribution will overshoot uniform distribution min/max
        fun[0](0).should.equal(-10);
        fun[0](200).should.equal(10);

        // wide input distribution will undershoot uniform distribution min/max
        fun[1](-10).should.equal(-0.5);
        fun[1](-5).should.equal(0.5);
    })
    it("MapLayer.mapFun(n,statsIn,statsOut,'mapMinMax') creates normalization function vector", function() {
        var stats = [{
            min: 0,
            max: 200,
        }, {
            min: -10,
            max: -5,
        }];
        var fun = MapLayer.mapFun(2, stats, null, 'mapMinMax');
        fun[0](0).should.equal(-1);
        fun[0](200).should.equal(1);
        fun[1](-10).should.equal(-1);
        fun[1](-5).should.equal(1);

        var fun = MapLayer.mapFun(2, null, stats, 'mapMinMax');
        fun[0](-1).should.equal(0);
        fun[0](1).should.equal(200);
        fun[1](-1).should.equal(-10);
        fun[1](1).should.equal(-5);

        var fun = MapLayer.mapFun(2, null, null, 'mapMinMax');
        fun[0](0).should.equal(0);
        fun[0](200).should.equal(200);
        fun[1](-10).should.equal(-10);
        fun[1](-5).should.equal(-5);
    })
    it("MapLayer.mapExpr(n,statsIn,statsOut,'mapMinMax') creates normalization expression vector", function() {
        var stats = [{
            min: 0,
            max: 200,
        }, {
            min: -10,
            max: -5,
        }];
        var fun = MapLayer.mapExpr(2, stats, null, 'mapMinMax');
        var layer = new MapLayer(fun);
        var y = ["y0", "y1"];
        should.deepEqual(layer.expressions(y), [
            "((y0) - 100)*0.01",
            "((y1) - -7.5)*0.4",
        ]);
    })
})
