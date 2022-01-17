import datetime
import yaml

def validate_config(config):
    if not isinstance(config, dict):
        raise TypeError("Expected config object to be a dict")

    if 'sensors' not in config.keys():
        raise TypeError("Expected config to contain sensors section")

    sensors = config['sensors']
    luftdaten_sensors = sensors.get('luftdaten', {})

    if len(luftdaten_sensors) == 0:
        raise ValueError("Expected some luftdaten sensors to be defined in config")

    for sensor_code, sensor in luftdaten_sensors.items():
        if not isinstance(sensor, dict):
            raise TypeError("Expected luftdaten sensor config "
                            "object to be a dict")

        if 'name' not in sensor:
            raise TypeError("Expected luftdaten sensor config "
                            "object to have name")
        if not isinstance(sensor['name'], str):
            raise TypeError("Expected luftdaten sensor config "
                            "name to be string")

        if 'start_date' not in sensor:
            raise TypeError("Expected luftdaten sensor config "
                            "object to have start_date")
        if not isinstance(sensor['start_date'], datetime.date):
            raise TypeError("Expected luftdaten sensor config "
                            "start_date to be a date")

        if 'location' not in sensor:
            raise TypeError("Expected luftdaten sensor config "
                            "object to have location")
        if not isinstance(sensor['location'], dict):
            raise TypeError("Expected luftdaten sensor config "
                            "location to be dict")
        location = sensor['location']
        if 'latitude' not in location or \
            not isinstance(location['latitude'], float):
            raise TypeError("Expected luftdaten sensor config "
                            "location to have latitude (number)")
        if 'longitude' not in location or \
            not isinstance(location['longitude'], float):
            raise TypeError("Expected luftdaten sensor config "
                            "location to have longitude (number)")

def get_config(file_path):
    """Loads the sensor config file."""
    with open(file_path, 'r') as stream:
        try:
            config = yaml.safe_load(stream)
        except yaml.YAMLError as exc:
            logger.exception("There was a problem opening the config file.")
            raise

    validate_config(config)

    return config
