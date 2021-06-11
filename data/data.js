const d3 = require("d3"),
      fs = require("fs"),
      urbanCentres = [ "122133", "802001", "822001", "102001", "115065" ];

console.log("reading urban centre data");
fs.readFile("./ucl.geojson", "utf8", function(error, data) {
  if (error) throw error;

  ucls = JSON
    .parse(data)
    .features
    .map(function(d) {
      d.properties = {
        code: d.properties.UCL_CODE16,
        name: d.properties.UCL_NAME16
      };
      return d;
    })
    .filter(function(d) {
      return urbanCentres.includes(d.properties.code);
    });

  console.log("reading sa1 2016 data");
  fs.readFile("./sa1_2016.geojson", "utf8", function(error, data) {
    if (error) throw error;

    sa1s2016 = JSON
      .parse(data)
      .features
      .filter(function(d) {
        return (d.properties.STE_CODE16 == "1" || d.properties.STE_CODE16 == "8") && (d.properties.AREASQKM16 > 0);
      })
      .map(function(d) {
        d.properties = {
          code: d.properties.SA1_7DIG16,
          area: d.properties.AREASQKM16,
          centroid: d3.geoCentroid(d)
        };
        return d;
      });

    console.log("filter sa1 areas");
    regionSa1s = {
      type: "FeatureCollection",
      features: []
    };
    ucls.forEach(function(d) {
      console.log("collecting sa1 areas in " + d.properties.code);
      sa1s2016.forEach(function(e) {
        if (e.properties.centroid) {
          if (d3.geoContains(d, e.properties.centroid)) {
            e.properties = {
              code: e.properties.code,
              area: e.properties.area
            };
            regionSa1s.features.push(e);
          }
        }
      });
    });

    console.log("reading sa1 2011 data");
    fs.readFile("./sa1_2011.geojson", "utf8", function(error, data) {
      if (error) throw error;

      sa1s2011 = JSON
        .parse(data)
        .features
        .filter(function(d) {
          return (d.properties.STE_CODE11 == "1" || d.properties.STE_CODE11 == "8") && (d.properties.ALBERS_SQM > 0);
        })
        .map(function(d) {
          d.properties = {
            code: d.properties.SA1_7DIG11,
            area: d.properties.ALBERS_SQM,
            centroid: d3.geoCentroid(d)
          };
          return d;
        });

      console.log("checking old sa1 areas");
      existingSa1s = regionSa1s.features
        .map(function(d) {
          return d.properties.code;
        });
      ucls.forEach(function(d) {
        console.log("collecting sa1 areas in " + d.properties.code);
        sa1s2011.forEach(function(e) {
          if (e.properties.centroid) {
            if (d3.geoContains(d, e.properties.centroid)) {
              if (!existingSa1s.includes(e.properties.code)) {
                e.properties = {
                  code: e.properties.code,
                  area: e.properties.area
                };
                regionSa1s.features.push(e);
              }
            }
          }
        });
      });

      console.log("reading 2011 population data");
      fs.readFile("./population2011.csv", "utf8", function(error, data) {
        if (error) throw error;

        pop2011 = d3.csvParse(data)
          .map(function(d) {
            return {
              code: d[Object.keys(d)[0]],
              pop: +d[Object.keys(d)[1]],
            };
          })
          .filter(function(d) {
            return d.code.slice(0, 1) == "1" || d.code.slice(0, 1) == "8";
          });

        console.log("reading 2016 population data");
        fs.readFile("./population2016.csv", "utf8", function(error, data) {
          if (error) throw error;

          pop2016 = d3.csvParse(data)
            .map(function(d) {
              return {
                code: d[Object.keys(d)[0]],
                pop: +d[Object.keys(d)[1]],
              };
            })
            .filter(function(d) {
              return d.code.slice(0, 1) == "1" || d.code.slice(0, 1) == "8";
            });

          console.log("assigning population values");
          regionSa1s.features
            .forEach(function(d) {
              let match2011 = pop2011
                .filter(function(e) {
                  return e.code == d.properties.code;
                });
              if (match2011.length == 1) {
                d.properties.pop = [match2011[0].pop];
              } else {
                d.properties.pop = [0];
              }
              let match2016 = pop2016
                .filter(function(e) {
                  return e.code == d.properties.code;
                });
              if (match2016.length == 1) {
                d.properties.pop.push(match2016[0].pop);
              } else {
                d.properties.pop.push(0);
              }
            });

          regionSa1s.features = regionSa1s
            .features
            .map(function(d) {
              d.properties = {
                density: [
                  d.properties.pop[0] / d.properties.area,
                  d.properties.pop[1] / d.properties.area,
                ]
              };
              return d;
            });

          fs.writeFile("./regionSa1s.geojson", JSON.stringify(regionSa1s), function(error) {
            console.log("regionSa1s.geojson written");
          });
        });
      });
    });
  });
});
