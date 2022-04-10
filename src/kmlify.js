'use strict';

const { create } = require('xmlbuilder2');

export default class KMLify {
  constructor(options = {}) {
    const name = options.name === undefined ? 'kml' : options.name;
    const open = options.open === undefined ? '1' : options.open;

    this.kml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('kml', {
        xmlns: 'http://www.opengis.net/kml/2.2',
        'xmlns:gx': 'http://www.google.com/kml/ext/2.2',
        'xmlns:kml': 'http://www.opengis.net/kml/2.2',
        'xmlns:atom': 'http://www.w3.org/2005/Atom',
      })
      .ele('Document')
      .ele('name')
      .txt(name)
      .up()
      .ele('open')
      .txt(open)
      .up();

    const style = {
      Style: {
        '@id': 'sh_pushpin',
        IconStyle: {
          scale: '1.0',
          Icon: {
            href: 'http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png',
          },
          hotSpot: {
            '@x': 20,
            '@y': 2,
            '@xunits': 'pixels',
            '@yunits': 'pixel',
          },
        },
        LineStyle: {
          color: 'ff0000ff',
          width: 5,
        },
        PolyStyle: {
          color: '4dff0000',
        },
      },
      StyleMap: {
        '@id': 'msn_pushpin',
        Pair: [
          {
            key: 'normal',
            styleUrl: 'sh_pushpin',
          },
          {
            key: 'highlight',
            styleUrl: 'sh_pushpin',
          },
        ],
      },
    };

    this.kml.ele(style);
  }

  placemark(pm) {
    if (!Array.isArray(pm.coordinates)) {
      throw new TypeError('Coordinates not provided');
    }

    const name = pm.name === undefined ? 'new-placemark' : pm.name;
    const coordinates = pm.coordinates.map(c => c.join(',')).join(' '); // coordinates are delivered in format [[-102.0000492, 41.07128125, 20062], [-101.9940706, 41.07336908, 19669]]

    const placemark = {
      Placemark: {
        name: name,
        styleUrl: 'msn_pushpin',
        LineString: {
          extrude: 1,
          tessellate: 1,
          //altitudeMode: 'absolute',
          coordinates: coordinates,
        },
      },
    };

    this.kml.ele(placemark);
  }

  pushpin(pp) {
    const name = pp.name === undefined ? 'new-pushpin' : pp.name;
    const coordinates = pp.coordinates.join(',');

    const pushpin = {
      Placemark: {
        name: name,
        ExtendedData: {
          Data: {
            '@name': 'Sensor Readings',
            value: JSON.stringify(pp.value, null, 2),
          },
        },
        Point: {
          altitudeMode: 'absolute',
          coordinates: coordinates,
        },
      },
    };

    this.kml.ele(pushpin);
  }

  stringify(pretty = true) {
    return this.kml.end({ prettyPrint: pretty });
  }
}

//module.exports = KMLify;
//export default KMLify;
