const turf = require("@turf/turf");
try {
  turf.buffer(turf.polygon([[[0,0], [0,1], [1,1], [1,0], [0,0]]]), 1);
  console.log("buffer works");
} catch(e) {
  console.log("buffer fails", e.message);
}
