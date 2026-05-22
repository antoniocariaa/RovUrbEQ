const turf = require("@turf/turf");

async function run() {
  const boundaryRes = await fetch("http://localhost:3000/api/boundary");
  const boundary = await boundaryRes.json();
  console.log("Boundary type:", boundary.geometry.type);
  console.log("Boundary bbox:", turf.bbox(boundary));
}
run();
