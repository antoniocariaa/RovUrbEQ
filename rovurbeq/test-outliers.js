const mongoose = require("mongoose");
async function run() {
  await mongoose.connect("mongodb+srv://antoniocaria1_db_user:uKYj4nbMZj2JO2ai@cluster0.pxbazdu.mongodb.net/test");
  const db = mongoose.connection.db;
  const docs = await db.collection("locations").find({}).toArray();
  let outliers = 0;
  docs.forEach(doc => {
     let coords = doc.geometry.coordinates;
     if (doc.geometry.type === "Point") {
        if (coords[0] < 10.9 || coords[0] > 11.1 || coords[1] < 45.8 || coords[1] > 46.0) {
           outliers++;
           console.log("Outlier:", doc.name || doc.properties.name, coords);
        }
     }
  });
  console.log("Total outliers:", outliers);
  mongoose.disconnect();
}
run();
