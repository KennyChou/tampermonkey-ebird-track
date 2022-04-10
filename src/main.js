import Vue from 'vue'
import App from './app.vue'
import { isDev } from './config'

const id = `app_vue_${Date.now()}`
const root = document.createElement('div')
root.id = id

if (isDev) {
  document.body.appendChild(root)
} else {
  const header = document.getElementById('tracks')
  header.after(root)
}

new Vue({
  el: `#${id}`,
  render: h => h(App),
})
