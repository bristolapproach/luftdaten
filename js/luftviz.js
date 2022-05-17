var luftviz = luftviz || {};

luftviz.chart24hourMean = (function (d3, vega) {
    // Private properties
    var dateField = "timestamp",
        dateFormat = "%-d %b %y",
        euLimitPM10 = 45,
        euLimitPM2point5 = 15,

        createVegaTooltipOptions = function (valField) {
            return {
                showAllFields: false,
                fields: [
                    {
                        field: dateField,
                        title: "Date",
                        formatType: "time",
                        format: dateFormat + " %H:%M"
                    },
                    {
                        field: valField,
                        title: "Val"
                    }

                ]
            }
        },

        // Private methods
        createSpec = function (data, valField, dateField, limitValue) {
            // Creates a vega spec
            var minMaxDates, minDate, maxDate, limitValues;

            // Find the min and max dates
            minMaxDates = d3.extent(data.map(d => d[dateField]));
            minDate = minMaxDates[0];
            maxDate = minMaxDates[1];

            // Create data for EU recommended limits line
            limitValues = [
                {
                    "date": minDate,
                    "value": limitValue
                },
                {
                    "date": maxDate,
                    "value": limitValue
                }
            ];

            var spec = {
                "$schema": "https://vega.github.io/schema/vega/v3.json",
                "width": 400,
                "height": 200,
                "padding": 5,

                "data": [
                    {
                        "name": "table",
                        "values": data
                    },
                    {
                        "name": "limitEU",
                        "values": limitValues
                    }
                ],

                "scales": [
                    {
                        "name": "x",
                        "type": "time",
                        "range": "width",
                        "domain": {"data": "table", "field": dateField}
                    },
                    {
                        "name": "y",
                        "type": "linear",
                        "range": "height",
                        "nice": true,
                        "zero": true,
                        "domain": {
                            "fields": [
                                {"data": "table", "field": valField},
                                {"data": "limitEU", "field": "value"}
                            ]
                        }
                    },
                    {
                        "name": "color",
                        "type": "ordinal",
                        "range": "category",
                        "domain": {"data": "table", "field": valField}
                    },
                    {
                        "name": "colorPM",
                        "type": "ordinal",
                        "range": "category",
                        "domain": {"data": "table", "field": valField}
                    }
                ],

                "axes": [
                    {
                        "orient": "bottom",
                        "scale": "x",
                        "format": dateFormat,
                        "labelOverlap": "true"
                    },
                    {
                        "orient": "left",
                        "scale": "y"
                    }
                ],

                "marks": [
                    // Sensor data
                    {
                        "type": "symbol",
                        "from": {"data": "table"},
                        "encode": {
                            "enter": {
                                "x": {"scale": "x", "field": dateField},
                                "y": {"scale": "y", "field": valField},
                                "fill": {"value": "#4c78a8"},
                                "size": {"value": 5}
                            }
                        }
                    },
                    // Limits
                    {
                        "type": "line",
                        "from": {"data": "limitEU"},
                        "encode": {
                            "enter": {
                                "x": {"scale": "x", "field": "date"},
                                "y": {"scale": "y", "field": "value"},
                                "stroke": {"value": "#ff0000"},
                                "strokeWidth": {"value": 2}
                            },
                            "update": {
                                "fillOpacity": {"value": 1}
                            },
                            "hover": {
                                "fillOpacity": {"value": 0.5}
                            }
                        }
                    }
                ]
            };
            return spec;
        },
        render = function (el, data, valueField, options) {
            var limitValue = valueField == "P1" ? euLimitPM10 : euLimitPM2point5,
                specCopy = createSpec(data, valueField, dateField, limitValue),
                vegaTooltipOptions,
                view;

            if (options) {
                if (options.domain) {
                    let domain, yScales;
                    // TODO: Set Y axis domain
                    // TODO: Pass in benchmarks/limits so they can be factored in to domain
                    domain = options.domain;
                    domain[1] = Math.max(domain[1], limitValue);
                    yScales = specCopy.scales.filter(function (item) {
                        return item.name === 'y';
                    });
                    if (yScales.length > 0) {
                        yScales[0].domain = domain;
                    }
                }
            }

            vegaTooltipOptions = createVegaTooltipOptions(valueField),
            view = new vega.View(vega.parse(specCopy))
                .renderer('canvas')  // set renderer (canvas or svg)
                .initialize(el) // initialize view within parent DOM container
                .hover()             // enable hover encode set processing
                .run();
            vegaTooltip.vega(view, vegaTooltipOptions);

//            d3.csv(dataUrl, function(data) {
//                // Set data types
//                var parseDate = d3.timeParse("%Y-%m-%d %H:%M:%S");
//                data.forEach(function(d) {
//                    d[dateField] = parseDate(d[dateField]);
//                    d[valueField] = +d[valueField];
//                });
//
//
//            });
        };

    // Public interface
    return {
        render: render
    }
} (d3, vega));

luftviz.dayOfWeekCircular = (function (d3) {
    // Private properties
    var dateField = "timestamp",
        dateFormat = "%-d %b %y",

        // Private methods
        render = function (el, dataUrl, valueField, limitValue) {
            // limitValue is the EU air quality limit
            d3.csv(dataUrl, function(data) {
                // Set data types
                data.forEach(function(d) {
                    d.hourOfDay = +d.hourOfDay;
                    d[valueField] = +d[valueField];
                });

                // The data for circular heat map list of values, one for each segment,
                // spiraling out from the centre outwards. This means we need to order
                // the rows by day of week and hour of day.

                var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

                // Make an lookup with order of days, e.g. {"Monday": 0, "Tuesday": 1, ...}
                var daysOrder = {};
                days.forEach( function (day, i) {
                    daysOrder[day] = i;
                });

                // Set segment number for each day/hour (starting from Monday 00:00)
                data.forEach(function(d) {
                    d.segmentId = (daysOrder[d.dayOfWeek] * 24) + d.hourOfDay
                });

                if (data.length !== 24 * 7) {
                    throw new Error("Expected one weeks worth of data values, one for each hour of the day")
                }

                // Sort the data
                data.sort( function(a, b) {return a.segmentId - b.segmentId} );

                var chart = circularHeatChart()
                    .accessor(function(d) {return d[valueField];})
                    // TODO: change based on PM2.5 or PM10
                    .domain([0, limitValue])
                    .segmentHeight(20)
                    .innerRadius(20)
                    .numSegments(24)
                    .radialLabels(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
                    .segmentLabels(["Midnight", "1am", "2am", "3am", "4am", "5am", "6am", "7am", "8am", "9am", "10am", "11am", "Midday", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm", "8pm", "9pm", "10pm", "11pm"])
                    .margin({top: 20, right: 20, bottom: 20, left: 20});

                d3.select(el)
                    .selectAll('svg')
                    .data([data])
                    .enter()
                    .append('svg')
                    .call(chart);

                    /* Add a mouseover event */
                    d3.selectAll(el + " path").on('mouseover', function() {
                    	var d = d3.select(this).data()[0],
                            txt = d.dayOfWeek + ' ' +
                                ("0" + d.hourOfDay).slice(-2) + ':00 value: ' +
                                (!isNaN(d[valueField]) ? d[valueField].toFixed(1) : d[valueField]);
                        d3.select("#info").text(txt);
                    });
                    d3.selectAll(el + " svg").on('mouseout', function() {
                        d3.select("#info").text('');
                    });
            });
        };

    // Public interface
    return {
        render: render
    }
} (d3));

luftviz.legendColorGradient = (function (d3) {
    // Private properties
    var dateField = "timestamp",
        dateFormat = "%-d %b %y",

        // Private methods
        render = function (el, domain, startColor, endColor) {
            var w = 300, h = 50;

            d3.select(el).select("svg").remove();

            var key = d3.select(el)
                .append("svg")
                .attr("width", w)
                .attr("height", h);

            var legend = key.append("defs")
                .append("svg:linearGradient")
                .attr("id", "gradient")
                .attr("x1", "0%")
                .attr("y1", "100%")
                .attr("x2", "100%")
                .attr("y2", "100%")
                .attr("spreadMethod", "pad");

            legend.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", startColor)
                .attr("stop-opacity", 1);

            legend.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", endColor)
                .attr("stop-opacity", 1);

            key.append("rect")
                .attr("width", w)
                .attr("height", h - 30)
                .style("fill", "url(#gradient)")
                .attr("transform", "translate(0,10)");

            var y = d3.scaleLinear()
                .range([300, 0])
                .domain(domain.slice().reverse());

            var yAxis = d3.axisBottom()
                .scale(y)
                .ticks(5);

            key.append("g")
                .attr("class", "y axis")
                .attr("transform", "translate(0,30)")
                .call(yAxis)
                .append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0)
                .attr("dy", ".71em")
                .style("text-anchor", "end")
                .text("axis title");
        };

    // Public interface
    return {
        render: render
    }
} (d3));
