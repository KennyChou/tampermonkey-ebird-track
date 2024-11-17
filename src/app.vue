<template>
  <div class="Page-section-inner Page-section-inner--md">
    <button @click="exportTrack" class="Button Button--highlight">
      下載軌跡
    </button>
  </div>
</template>

<script>
import { saveAs } from 'file-saver'
import KMLify from './kmlify'
export default {
  name: 'app',
  data() {
    return {}
  },
  methods: {
    exportTrack() {
      const data = this.getGPS()

      if (data.gpsdata.length == 0) {
        return
      }
      const kml = new KMLify({ name: data.locname })
      const coords = []
      for (let i = 0; i < data.gpsdata.length; i = i + 2) {
        coords.push([
          parseFloat(data.gpsdata[i]),
          parseFloat(data.gpsdata[i + 1]),
        ])
      }
      kml.placemark({
        name: data.sid + ' ' + data.date + ' ' + data.time,
        coordinates: coords,
      })
      this.kml2export(kml.stringify(), data.locname)
    },
    kml2export(kmlstr, filename) {
      const data = new Blob([kmlstr], {
        type: 'text/xml',
      })

      return saveAs(data, filename + '.kml')
    },
    getGPS() {
      var locname
      if (
        this.xpath(
          document,
          '//section[@aria-labelledBy="primary-details"]//div[@class="Heading Heading--h3 u-margin-none"]//a'
        ).length > 0
      ) {
        locname = this.xpath(
          document,
          '//section[@aria-labelledBy="primary-details"]//div[@class="Heading Heading--h3 u-margin-none"]//a//span'
        )[0].textContent
      } else {
        locname = this.xpath(
          document,
          '//section[@aria-labelledBy="primary-details"]//div[@class="Heading Heading--h3 u-margin-none"]//span'
        )[0].textContent
      }
      const sid = this.xpath(document, '//input[@name="subID"]')[0].value
      // const sid = xpath(document, '//a[@id="chk-tools-delete"]')[0].dataset['subid']
      const [d, t] = this.xpath(document, '//time')[0].dateTime.split('T')

      if (this.xpath('', '//div[@data-maptrack]').length == 2) {
        return {
          locname: locname,
          gpsdata: this.xpath('', '//div[@data-maptrack]')[0].dataset[
            'maptrackData'
          ].split(','),
        }
      }
      return { locname: locname, gpsdata: [] }
    },

    xpath(node, xpathToExecute) {
      node = node == '' ? document : node
      var result = []
      var nodesSnapshot = document.evaluate(
        xpathToExecute,
        node,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      )
      for (var i = 0; i < nodesSnapshot.snapshotLength; i++) {
        result.push(nodesSnapshot.snapshotItem(i))
      }
      return result
    },
  },
}
</script>
