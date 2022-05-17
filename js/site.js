"use strict";

// Single Page App inspired by:
// https://tutorialzine.com/2015/02/single-page-app-without-a-framework

$(function () {
    var defaultValueField = "P2",
        euLimitPM10 = 45,
        euLimitPM2point5 = 15;

    function getSensorsHashFragment (elSensor1, elDate1, elSensor2, elDate2, elValueField) {
        // Get url type hash fragment to represent current
        // sensor selection state
        return "sensor1=" + $(elSensor1).val() +
            "&date1=" + $(elDate1).val() +
            "&sensor2=" + $(elSensor2).val() +
            "&date2=" + $(elDate2).val() +
            "&valueField=" + $(elValueField).val() || defaultValueField;
    }

    function getDayOfWeekSensorsHashFragment () {
        // Get url type hash fragment to represent current
        // sensor selection state
        return getSensorsHashFragment(
            '#sensor-code-day-of-week-1',
            '#sensor-date-day-of-week-1',
            '#sensor-code-day-of-week-2',
            '#sensor-date-day-of-week-2',
            '#value-field-day-of-week'
        );
    }

    function getOverTimeSensorsHashFragment () {
        // Get url type hash fragment to represent current
        // sensor selection state
        return getSensorsHashFragment(
            '#sensor-code-over-time-1',
            '#sensor-date-over-time-1',
            '#sensor-code-over-time-2',
            '#sensor-date-over-time-2',
            '#value-field-over-time'
        );
    }

    function parseSensorsHashFragment (fragment) {
        let keyValuePairs = fragment.split('&'),
            // Defaults:
            store = {
                valueField: defaultValueField,
                sensor1: null,
                date1: null,
                sensor2: null,
                date2: null
            };

        // Override defaults with query string values
        $.each(keyValuePairs, function (i, keyValuePair) {
            let keyValue = keyValuePair.split('=');
            if (keyValue.length !== 2) {
                throw new Error("Query string key value pair not formatted correctly");
            }
            store[keyValue[0]] = keyValue[1] === 'null' ? null : keyValue[1];
        });

        return store;
    }

    function setPageTitle (title) {
        $('#page-title').text(title);
    }

    function parseHyphenatedDate (dateStr) {
        let parts = dateStr.split('-');
        return {year: parts[0], month: parts[1]};
    }

    function cleanData(data, dateField, valueField) {
        // Cleans the data by setting data types
        // Note: mutates data
        var parseDate = d3.timeParse("%Y-%m-%d %H:%M:%S");
        data.forEach(function(d) {
            d[dateField] = parseDate(d[dateField]);
            d[valueField] = +d[valueField];
        });
        return data;
    }

    $.getJSON( "data/luftdaten/aggregated/sensor-summary.json", function( configData ) {
        // Get data about sensors from sensor-summary.json.

        $(
            '#sensor-code-day-of-week-1, #sensor-date-day-of-week-1, ' +
            '#sensor-code-day-of-week-2, #sensor-date-day-of-week-2, ' +
            '#value-field-day-of-week'
        ).change(function () {
            let hashFragment = getDayOfWeekSensorsHashFragment();
            window.location.hash = 'dayofweek/' + hashFragment;
        });

        $(
            '#sensor-code-over-time-1, #sensor-date-over-time-1, ' +
            '#sensor-code-over-time-2, #sensor-date-over-time-2, ' +
            '#value-field-over-time'
        ).change(function () {
            let hashFragment = getOverTimeSensorsHashFragment();
            window.location.hash = 'overtime/' + hashFragment;
        });

        $('#nav-home').click(function () {
            window.location.hash = '';
        });

        $('#nav-day-of-week').click(function () {
            let hashFragment = getDayOfWeekSensorsHashFragment();
            window.location.hash = 'dayofweek/' + hashFragment;
        });

        $('#nav-over-time').click(function () {
            let hashFragment = getOverTimeSensorsHashFragment();
            window.location.hash = 'overtime/' + hashFragment;
        });

        $(window).on('hashchange', function(){
            // On every hash change the render function is called with the new hash.
            // This is how the navigation of our app happens.
            render(decodeURI(window.location.hash), configData);
        });

        // Manually trigger a hashchange to start the app.
        $(window).trigger('hashchange');
    })
        .fail(function() {
            alert("Couldn't find the sensor config file. Make sure you've run the Python scripts to generate the data.");
        });

    function render(url, config) {
        // This function decides what type of page to show
        // depending on the current url hash value.

        // Get the keyword from the url.
        var temp = url.split('/')[0];

        // Hide whatever page is currently shown.
        setPageTitle("");
        $('.main-content .page').addClass('hidden');

        console.log("Rendering", temp)

        var map = {

            // The Homepage.
            '': function() {
                renderHomePage();
            },

            // Day of week page
            '#dayofweek': function() {
                // Get the info from url hash string and render page
                var selectedHashFragment = url.split('#dayofweek/')[1].trim(),
                    selectedInfo = parseSensorsHashFragment(selectedHashFragment);
                renderDayOfWeekPage(
                    config,
                    selectedInfo.valueField,
                    selectedInfo.sensor1,
                    selectedInfo.date1,
                    selectedInfo.sensor2,
                    selectedInfo.date2
                );
            },

            // Time series page
            '#overtime': function() {
                // Get the info from url hash string and render page
                var selectedHashFragment = url.split('#overtime/')[1].trim(),
                    selectedInfo = parseSensorsHashFragment(selectedHashFragment);
                renderOverTimePage(
                    config,
                    selectedInfo.valueField,
                    selectedInfo.sensor1,
                    selectedInfo.date1,
                    selectedInfo.sensor2,
                    selectedInfo.date2
                );
            },

            // Single Products page.
            '#product': function() {

                // Get the index of which product we want to show and call the appropriate function.
                var index = url.split('#product/')[1].trim();

                renderSingleProductPage(index, products);
            },

            // Page with filtered products
            '#filter': function() {

                // Grab the string after the '#filter/' keyword. Call the filtering function.
                url = url.split('#filter/')[1].trim();

                // Try and parse the filters object from the query string.
                try {
                    filters = JSON.parse(url);
                }
                // If it isn't a valid json, go back to homepage ( the rest of the code won't be executed ).
                catch(err) {
                    window.location.hash = '#';
                }

                renderFilterResults(filters, products);
            }

        };

        // Execute the needed function depending on the url keyword (stored in temp).
        if(map[temp]){
            map[temp]();
        }
        // If the keyword isn't listed in the above - render the error page.
        else {
            renderErrorPage();
        }
    }

    function populateSensors (el, config, selectedVal) {
        // Create drop down list of sensors
        $(el).append($('<option>', {value: '', text: 'Select sensor...'}));

        $.each(config.luftdaten_sensors, function (i, sensor) {
            var name = sensor.name + ' (' + sensor.code + ')',
                code = sensor.code;
            $(el).append($('<option>', {
                value: code,
                text: name,
                selected: code.toString() === selectedVal
            }));
        });
    };

    function getMonthName(monthNumber) {
        // Use non zero based month number, e.g. May = 5
        const monthNames = [
            "January", "February", "March",
            "April", "May", "June",
            "July", "August", "September",
            "October", "November", "December"
        ];
        return monthNames[monthNumber-1];
    }

    function sortDates (listOfDates) {
        listOfDates.sort(function (a, b) {
            if (a.year === b.year) {
                if (a.month < b.month)
                    return -1;
                if (a.month > b.month)
                    return 1;
                return 0;
            } else {
                if (a.year < b.year)
                    return -1;
                if (a.year > b.year)
                    return 1;
                return 0;
            }
        })
        return listOfDates;
    }

    function populateDates (el, sensorConfig, selectedVal, dataType) {
        // Create drop down list of dates
        $(el).append($('<option>', {value: '', text: 'Select date...'}));

        let listOfDates = [];
        $.each(sensorConfig[dataType].available_dates, function (year, yearData) {
            $.each(yearData, function (i, monthData) {
                listOfDates.push({
                    'year': year,
                    'month': monthData.month
                });
            });
        });
        listOfDates = sortDates(listOfDates);

        $.each(listOfDates, function (i, dateInfo) {
            let optionVal = dateInfo.year + '-' + dateInfo.month;
            $(el).append(
                $(
                    '<option>',
                    {
                        value: optionVal,
                        text: getMonthName(dateInfo.month) + ' ' + dateInfo.year,
                        selected: optionVal === selectedVal
                    }
                )
            );
        });
    };

    function getLimitValue(valueField) {
        return valueField == "P1" ? euLimitPM10 : euLimitPM2point5
    }

    function renderHomePage(){
        // Hides and shows products in the All Products Page depending on the data it receives.
        setPageTitle("Home");
        var page = $('.home-page');

        // Show the page itself.
        // (the render function hides all pages so we need to show the one we want).
        page.removeClass('hidden');
    }

    function populateSensorAndDateDropDowns(configData, sensorSelectEl,
        dateSelectEl, selectedSensor, selectedDate, chartType) {
        $(sensorSelectEl).find('option').remove();
        $(dateSelectEl).find('option').remove();
        populateSensors(sensorSelectEl, configData, selectedSensor);
        if (selectedSensor) {
            let sensorConfig = config.getSensorConfig(configData, selectedSensor);
            populateDates(dateSelectEl, sensorConfig, selectedDate, chartType);
        }
    }

    function renderDayOfWeekPage(configData, valueField, sensorCode1, date1, sensorCode2, date2) {
        setPageTitle("Best/worst times of the week");
        var page = $('.day-of-week'),
            limitValue = getLimitValue(valueField),
            sensors = [
                {
                    id: 1,
                    code: sensorCode1,
                    date: date1,
                    isActive: sensorCode1 && date1
                },
                {
                    id: 2,
                    code: sensorCode2,
                    date: date2,
                    isActive: sensorCode2 && date2
                }
            ],
            domain = [0, limitValue];

        // Value field
        $('#value-field-day-of-week').val(valueField);

        // Populate drop downs
        $.each(sensors, function (i, sensor) {
            populateSensorAndDateDropDowns(
                configData,
                '#sensor-code-day-of-week-' + sensor.id,
                '#sensor-date-day-of-week-' + sensor.id,
                sensor.code,
                sensor.date,
                'day_of_week');
        });

        // Display charts
        $.each(sensors, function (i, sensor) {
            var chartEl = '#day-of-week-chart-' + sensor.id,
                dateInfo, dataUrl;
            $(chartEl).empty();
            if (sensor.isActive) {
                dateInfo = parseHyphenatedDate(sensor.date);
                dataUrl = config.dayOfWeekDataUrl(configData, sensor.code, dateInfo.year, dateInfo.month);
                luftviz.dayOfWeekCircular.render(chartEl, dataUrl, valueField, limitValue);
            } else {
                $(chartEl).text('[Select sensor and date above]');
            }
        });

        // Set the legend
        luftviz.legendColorGradient.render(
            '#day-of-week-legend',
            domain,
            'white',
            'red'
        );


        // Show the page itself.
        // (the render function hides all pages so we need to show the one we want).
        page.removeClass('hidden');
    }

    function renderOverTimePage(configData, valueField, sensorCode1, date1, sensorCode2, date2) {
        setPageTitle("Air quality over time");
        var page = $('.over-time'),
            sensors = [
                {
                    id: 1,
                    code: sensorCode1,
                    date: date1,
                    isActive: sensorCode1 && date1
                },
                {
                    id: 2,
                    code: sensorCode2,
                    date: date2,
                    isActive: sensorCode2 && date2
                }
            ];

        // Value field
        $('#value-field-over-time').val(valueField);

        // Populate drop downs
        $.each(sensors, function (i, sensor) {
            populateSensorAndDateDropDowns(
                configData,
                '#sensor-code-over-time-' + sensor.id,
                '#sensor-date-over-time-' + sensor.id,
                sensor.code,
                sensor.date,
                '24_hour_means');
        });

        // Prepare data download
        var queue = d3.queue();
        $.each(sensors, function (i, sensor) {
            var chartEl = '#twentyfour-hour-means-chart-' + sensor.id,
                dateInfo, dataUrl;
            $(chartEl).empty();
            if (sensor.isActive) {
                dateInfo = parseHyphenatedDate(sensor.date);
                dataUrl = config.twentyFourHourMeansDataUrl(configData, sensor.code, dateInfo.year, dateInfo.month);
                queue.defer(d3.csv, dataUrl);
            } else {
                $(chartEl).text('[Select sensor and date above]');
            }
        });

        // Get data and draw chart
        queue.await(function(error) {
            var dataArgs = [],
                dateField = "timestamp",
                data, argIndex, maxValue;
            if (error) {
                console.error('Something went wrong when fetching data. ' + error);
            }
            else {
                // Call succeeded, get loaded datasets from d3.queue.await() callback
                for (argIndex = 1; argIndex < arguments.length; argIndex++) {
                    data = arguments[argIndex];
                    data = cleanData(data, dateField, valueField);
                    dataArgs.push(data);
                }

                maxValue = d3.max(dataArgs, function(array) {
                    return d3.max(array, function (d) {return d[valueField]});
                });

                $.each(sensors, function (i, sensor) {
                    var chartEl = '#twentyfour-hour-means-chart-' + sensor.id,
                        data;
                    if (sensor.isActive) {
                        // Display chart
                        data = dataArgs.shift();
                        luftviz.chart24hourMean.render(
                            chartEl,
                            data,
                            valueField,
                            {
                                domain: [0, maxValue]
                            }
                        );
                    }
                });
            }
        });

        // Show the page itself.
        // (the render function hides all pages so we need to show the one we want).
        page.removeClass('hidden');
    }

    function renderErrorPage(){
        // Shows the error page.
    }

});


//var scale = d3.scaleBand()
//    .domain([1, 2, 3])
//    .range([0, 100]);
//
//
//var scaleOrd = d3.scaleOrdinal()
//    .domain([1, 2, 3])
//    .range([d3.rgb("red"), d3.rgb("green"), d3.rgb("blue")]);
//
