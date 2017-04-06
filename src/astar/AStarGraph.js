var mathjs = require("mathjs");

(function(exports) { 
    class AStarGraph {
        constructor(options = {}) {
            this.openMap = new WeakMap();
            this.closedSet = new WeakMap();
            this.fScoreMap = new WeakMap();
            this.gScoreMap = new WeakMap();
            this.cameFrom = new WeakMap();
        }
        neighborsOf(node, goal) {
            // NOTE: neighbors can be generated dynamically, but they must be unique
            throw new Error("neighborsOf(node) must be overridden by subclass");
        }
        cost(node1, node2) {
            // actual cost 
            throw new Error("cost(node1, node2) must be overridden by subclass");
        }
        estimateCost(node1, node2) {
            // estimatedCost must be admissible (i.e., less than or equal to actual cost)
            throw new Error("estimateCost(node1, node2) must be overridden by subclass");
        }
        fscore(node) {
            var score = this.fScoreMap.get(node);
            return score == null ? Number.MAX_SAFE_INTEGER : score;
        }
        gscore(node) {
            var score = this.gScoreMap.get(node);
            return score == null ? Number.MAX_SAFE_INTEGER : score;
        }
        findPath(start, goal, options) { // Implements A* algorithm
            var openSet = [start];
            var onOpenSet = options.onOpenSet || (()=>true);
            this.fScoreMap.set(start, this.estimateCost(start, goal));
            this.gScoreMap.set(start, 0);
            var pathTo = (node) => {
                var totalPath = [node];
                while ((node = this.cameFrom.get(node))) {
                    totalPath.push(node);
                }
                return totalPath.reverse();
            };
            while (openSet.length && onOpenSet(openSet, pathTo)) {
                var current = openSet.shift();
                this.openMap.set(current, false);
                if (current === goal) {
                    return pathTo(current);
                }
                this.closedSet.set(current, true);
                this.neighborsOf(current, goal).forEach((neighbor) => {
                    if (!this.closedSet.get(neighbor)) {
                        var tentative_gScore = this.gscore(current) + this.cost(current, neighbor);
                        if (!this.openMap.get(neighbor)) {
                            this.openMap.set(neighbor, true);
                            openSet.push(neighbor);
                        } else if (tentative_gScore >= this.gscore(neighbor)) {
                            neighbor = null;
                        }
                        if (neighbor) {
                            this.cameFrom.set(neighbor, current);
                            this.gScoreMap.set(neighbor, tentative_gScore);
                            this.fScoreMap.set(neighbor, this.estimateCost(neighbor, goal));
                        }
                    }
                });
                openSet.sort((a,b) => this.fscore(a) - this.fscore(b));
            }
            return []; // no path
        }
    }

    module.exports = exports.AStarGraph = AStarGraph;
})(typeof exports === "object" ? exports : (exports = {}));

(typeof describe === 'function') && describe("AStarGraph", function() {
    var should = require("should");
    var AStarGraph = exports.AStarGraph;

    class TestNode {
        constructor(name) {
            this.name = name;
        }
    }

    it("AStarGraph subclass finds shortest path", function() {
        var verbose = false;
        // define a simple graph with weighted transitions between named nodes
        var nodeCosts = {
            START: {
                A: 1, // huge hills
                B: 3, // optimal
                C: 2, // dead end
            },
            A: { A1: 1, A2: 2, },
            A1: { END: 100, },
            A2: { END: 50, },
            B: { B1: 3, },
            B1: { END: 3, },
            C: { },
            END: { },
        }
        var nodes = {};
        Object.keys(nodeCosts).forEach((name) => nodes[name] = new TestNode(name));

        // extends AStarGrap with appropriate
        class TestGraph extends AStarGraph {
            constructor(costs, options) {
                super(options);
                this.costs = costs;
            }
            neighborsOf(node, goal) { 
                return Object.keys(this.costs[node.name]).map((name) => nodes[name]);
            }
            cost(n1, n2) {
                var neighborCost = n2 && this.costs[n1.name][n2.name]; // n2 is a neighbor of n1
                if (!neighborCost) {
                    throw new Error("cannot compute cost to non-neighbor");
                }
                return neighborCost;
            }
            estimateCost(n1, n2) {
                var neighborCost = n2 && this.costs[n1.name][n2.name]; // n2 is a neighbor of n1
                var minNeighborCost = () => { // n2 is not a neighbor of n1
                    // compute cost as minimum cost of n1 to its neighbors
                    var neighborCosts = this.costs[n1.name];
                    return Object.keys(neighborCosts).reduce(
                        (acc, name) => mathjs.min(acc, neighborCosts[name]),
                        Number.MAX_SAFE_INTEGER);
                }
                return neighborCost || minNeighborCost();
            }
        }

        var graph = new TestGraph(nodeCosts);
        var START = nodes.START;
        var A = nodes.A;
        var A1 = nodes.A1;
        var A2 = nodes.A2;
        var B = nodes.B;
        var B1 = nodes.B1;
        var END = nodes.END;
        graph.estimateCost(START, END).should.equal(1);
        graph.estimateCost(START, B).should.equal(3);
        graph.cost(A2, END).should.equal(50);
        graph.estimateCost(A2, END).should.equal(50);

        // find shortest path. If provided, onOpenSet() can be used
        // to trace each iteration or halt search by returning false
        var options = {
            onOpenSet: (openSet) => verbose && 
                console.log("openSet", JSON.stringify(openSet.map((node) => node.name)),
                    "gcost", graph.gscore(openSet[0]),
                    "fcost", graph.fscore(openSet[0])
                    ) 
                || true,
        };
        var path = graph.findPath(START, END, options); 
        should.deepEqual(path.map((n) => n.name), ["START","B","B1","END"]);
    })
})
