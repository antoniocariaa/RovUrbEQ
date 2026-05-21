const turf = require("@turf/turf");

const poly1 = turf.polygon([[[0, 0], [0, 5], [5, 5], [5, 0], [0, 0]]]);
const poly2 = turf.polygon([[[2, 2], [2, 7], [7, 7], [7, 2], [2, 2]]]);

try {
  const resultCollection = turf.intersect(turf.featureCollection([poly1, poly2]));
  console.log("Collection intersection worked:", resultCollection ? "Yes" : "No");
} catch(e) {
  console.log("Collection failed:", e.message);
}

try {
  const resultDirect = turf.intersect(poly1, poly2);
  console.log("Direct intersection worked:", resultDirect ? "Yes" : "No");
} catch(e) {
  console.log("Direct failed:", e.message);
}

