import "./Wardrobe.css"
// Wardrobe.jsx — embeds the original virtual_wardrobe.html logic exactly,
// with Cloudinary and Weather API keys injected from Vite env vars.

import { useEffect, useRef } from 'react'

export default function Wardrobe() {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return

    // Tailwind loaded via index.html
    initialized.current = true

    let CLOUD_NAME = ''
    let UPLOAD_PRESET = 'virtual_wardrobe'
    let WEATHER_KEY = ''

    async function fetchConfigAndInit() {
      try {
        const response = await fetch('/api/config')
        if (response.ok) {
          const config = await response.json()
          CLOUD_NAME = config.CLOUDINARY_CLOUD_NAME || ''
          UPLOAD_PRESET = config.CLOUDINARY_UPLOAD_PRESET || 'virtual_wardrobe'
          WEATHER_KEY = config.OPENWEATHER_API_KEY || ''
        }
      } catch (err) {
        console.error('Failed to fetch runtime config:', err)
      }

      // Inject Chart.js if not already present
      if (!window.Chart) {
        const chartScript = document.createElement('script')
        chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js'
        chartScript.onload = () => initApp()
        document.head.appendChild(chartScript)
      } else {
        initApp()
      }
    }

    fetchConfigAndInit()

    function initApp() {
      // ── State ──────────────────────────────────────────────────────────────
      let usageChart, favoritesChart

      const BACKEND_CONFIG = {
        BASE_URL: window.location.origin,
        SCHEDULE_ENDPOINT: '/api/schedule-outfit',
      }

      // ── Modal ──────────────────────────────────────────────────────────────
      const Modal = {
        overlay:    document.getElementById('modal-overlay'),
        modal:      document.getElementById('modal'),
        title:      document.getElementById('modal-title'),
        message:    document.getElementById('modal-message'),
        input:      document.getElementById('modal-input'),
        cancelBtn:  document.getElementById('modal-cancel'),
        confirmBtn: document.getElementById('modal-confirm'),

        show(options = {}) {
          return new Promise((resolve) => {
            this.confirmBtn.style.display = 'inline-block'
            this.cancelBtn.textContent = 'Cancel'
            this.input.classList.add('hidden')
            this.title.textContent   = options.title   || 'Confirm Action'
            this.message.textContent = options.message || 'Are you sure?'

            if (options.type === 'prompt') {
              this.input.classList.remove('hidden')
              this.input.placeholder = options.placeholder  || 'Enter value...'
              this.input.value       = options.defaultValue || ''
              this.input.type        = options.inputType    || 'text'
            }

            this.modal.className = 'modal'
            if (options.modalType) this.modal.classList.add(`modal-${options.modalType}`)

            this.cancelBtn.textContent  = options.cancelText  || 'Cancel'
            this.confirmBtn.textContent = options.confirmText || 'Confirm'
            this.overlay.classList.add('active')

            this.cancelBtn.onclick  = null
            this.confirmBtn.onclick = null
            this.overlay.onclick    = null

            if (options.type === 'alert') {
              this.confirmBtn.style.display = 'none'
              this.cancelBtn.textContent = 'OK'
              this.cancelBtn.onclick = () => { this.hide(); resolve(true) }
              this.overlay.onclick   = (e) => { if (e.target === this.overlay) { this.hide(); resolve(true) } }
              return
            }
            if (options.type === 'confirm') {
              this.cancelBtn.onclick  = () => { this.hide(); resolve(false) }
              this.confirmBtn.onclick = () => { this.hide(); resolve(true) }
              this.overlay.onclick    = (e) => { if (e.target === this.overlay) { this.hide(); resolve(false) } }
              return
            }
            if (options.type === 'prompt') {
              this.cancelBtn.onclick  = () => { this.hide(); resolve(null) }
              this.confirmBtn.onclick = () => { this.hide(); resolve(this.input.value) }
              this.overlay.onclick    = (e) => { if (e.target === this.overlay) { this.hide(); resolve(null) } }
              setTimeout(() => this.input.focus(), 200)
              return
            }
          })
        },
        hide()                                   { this.overlay.classList.remove('active') },
        confirm(title, message)                  { return this.show({ title, message, type: 'confirm', modalType: 'warning' }) },
        prompt(title, message, ph, def)          { return this.show({ title, message, type: 'prompt', placeholder: ph, defaultValue: def, modalType: 'info' }) },
        alert(title, message, modalType = 'info'){ return this.show({ title, message, type: 'alert', modalType }) },
      }

      // ── Init ───────────────────────────────────────────────────────────────
      loadOutfits()
      setupEventListeners()
      checkNotifications()

      // ── Event listeners ────────────────────────────────────────────────────
      function setupEventListeners() {
        document.getElementById('global-search').addEventListener('input', loadOutfits)
        document.getElementById('weather-btn').addEventListener('click', getWeatherSuggestions)

        document.getElementById('add-upper').addEventListener('click', () => document.getElementById('upper-file').click())
        document.getElementById('upper-file').addEventListener('change', (e) => handleFileUpload(e, 'upper'))

        document.getElementById('add-lower').addEventListener('click', () => document.getElementById('lower-file').click())
        document.getElementById('lower-file').addEventListener('change', (e) => handleFileUpload(e, 'lower'))

        document.getElementById('upper-filter').addEventListener('change', loadOutfits)
        document.getElementById('upper-season-filter').addEventListener('change', loadOutfits)
        document.getElementById('upper-sort').addEventListener('change', loadOutfits)
        document.getElementById('lower-filter').addEventListener('change', loadOutfits)
        document.getElementById('lower-season-filter').addEventListener('change', loadOutfits)
        document.getElementById('lower-sort').addEventListener('change', loadOutfits)

        document.getElementById('save-combination').addEventListener('click', saveCombination)
        document.getElementById('clear-preview').addEventListener('click', clearPreview)
        document.getElementById('schedule-outfit').addEventListener('click', scheduleOutfit)

        const upperDrop = document.getElementById('upper-drop')
        const lowerDrop = document.getElementById('lower-drop')
        ;[upperDrop, lowerDrop].forEach((zone) => {
          zone.addEventListener('dragover',  handleDragOver)
          zone.addEventListener('dragleave', handleDragLeave)
          zone.addEventListener('drop',      handleDrop)
        })
      }


      // ── Weather ────────────────────────────────────────────────────────────
      async function getWeatherSuggestions() {
        const city = await Modal.prompt('Weather Suggestions', 'Enter your city name:', 'e.g., London, New York', 'London')
        if (!city) return

        if (!WEATHER_KEY) {
          await Modal.alert('API Key Required', 'Add VITE_WEATHER_API_KEY to your frontend .env file.', 'warning')
          return
        }
        try {
          document.getElementById('weather-info').textContent = 'Fetching weather data...'
          document.getElementById('weather-suggestions').classList.remove('hidden')
          const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_KEY}&units=metric`)
          if (!response.ok) throw new Error(`Weather API error: ${response.status}`)
          displayWeatherSuggestions(await response.json())
        } catch (error) {
          document.getElementById('weather-info').textContent = `Failed: ${error.message}`
          document.getElementById('weather-suggestions').classList.remove('hidden')
        }
      }

      function displayWeatherSuggestions(d) {
        const temp = Math.round(d.main.temp), condition = d.weather[0].main
        const city = d.name, humidity = d.main.humidity, windSpeed = d.wind.speed
        let s = temp > 30 ? 'Very hot! Light breathable fabrics like cotton and linen.'
          : temp > 25 ? 'Hot weather: Light fabrics, shorts, breathable materials.'
          : temp > 20 ? 'Warm: Light layers, t-shirts, comfortable pants.'
          : temp > 15 ? 'Mild: Long sleeves, light jackets, jeans.'
          : temp > 10 ? 'Cool: Wear layers, jackets, warmer pants.'
          : temp > 5  ? 'Cold: Heavy layers, coats, warm accessories.'
          : temp > 0  ? 'Very cold: Insulated clothing, heavy coats.'
          : 'Freezing: Thermal layers, heavy winter coat required.'
        if (condition === 'Rain' || condition === 'Drizzle') s += ' Bring a waterproof jacket.'
        else if (condition === 'Snow') s += ' Wear waterproof boots and insulated clothing.'
        else if (condition === 'Clear') s += ' Sunny — sunglasses and sun protection recommended.'
        if (humidity > 80) s += ' High humidity — breathable fabrics will help.'
        document.getElementById('weather-info').innerHTML =
          `<strong>${city}: ${temp}°C, ${condition}</strong><br>Wind: ${windSpeed} m/s, Humidity: ${humidity}%<br>${s}`
        document.getElementById('weather-suggestions').classList.remove('hidden')
      }

      // ── Upload ─────────────────────────────────────────────────────────────
      async function handleFileUpload(event, type) {
        const file = event.target.files[0]
        if (!file) { await Modal.alert('No File Selected', 'Please select an image.', 'warning'); return }
        if (!file.type.startsWith('image/')) { await Modal.alert('Invalid File', 'Please select a valid image file.', 'warning'); return }

        const loadingElement = document.getElementById(`${type}-loading`)
        loadingElement.style.display = 'block'
        try {
          const cloudinaryUrl = await uploadToCloudinary(file, `wardrobe/${type}`)
          const name      = document.getElementById(`${type}-name`).value  || `My ${type} outfit`
          const brand     = document.getElementById(`${type}-brand`).value || 'Unknown'
          const clothType = document.getElementById(`${type}-cloth`).value || 'Unknown'
          const color     = '#000000'
          const outfit = { id: Date.now(), src: cloudinaryUrl, name, brand, clothType, color, usageCount: 0, isFavorite: false, dateAdded: new Date().toISOString(), lastWorn: null, scheduledDates: [] }
          saveOutfit(type, outfit)
          document.getElementById(`${type}-name`).value  = ''
          document.getElementById(`${type}-brand`).value = ''
          document.getElementById(`${type}-cloth`).value = ''
          document.getElementById(`${type}-file`).value  = ''
          await Modal.alert('Success!', `${type.charAt(0).toUpperCase() + type.slice(1)} outfit added successfully!`, 'success')
          loadOutfits()
        } catch (error) {
          await Modal.alert('Upload Failed', 'Could not upload image to Cloudinary.', 'error')
        } finally {
          loadingElement.style.display = 'none'
        }
      }

      async function uploadToCloudinary(file, folder = 'wardrobe') {
        if (!CLOUD_NAME) throw new Error('VITE_CLOUDINARY_CLOUD_NAME not set in .env')
        const formData = new FormData()
        formData.append('file', file)
        formData.append('upload_preset', UPLOAD_PRESET)
        formData.append('folder', folder)
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: formData })
        const data = await response.json()
        if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed')
        return data.secure_url
      }

      function saveOutfit(type, outfit) {
        const outfits = JSON.parse(localStorage.getItem(`${type}Outfits`) || '[]')
        outfits.push(outfit)
        localStorage.setItem(`${type}Outfits`, JSON.stringify(outfits))
      }

      // ── Load / filter / render ─────────────────────────────────────────────
      function loadOutfits() {
        const upper = JSON.parse(localStorage.getItem('upperOutfits') || '[]')
        const lower = JSON.parse(localStorage.getItem('lowerOutfits') || '[]')
        const combos = JSON.parse(localStorage.getItem('combinations') || '[]')
        renderOutfits(filterAndSortOutfits(upper, 'upper'), 'upper')
        renderOutfits(filterAndSortOutfits(lower, 'lower'), 'lower')
        renderCombinations(combos)
        updateStatistics(upper, lower)
      }

      function filterAndSortOutfits(outfits, type) {
        const searchTerm     = document.getElementById('global-search').value.toLowerCase()
        const sortBy         = document.getElementById(`${type}-sort`).value
        let filtered = outfits.filter(o =>
          !searchTerm || o.name.toLowerCase().includes(searchTerm) ||
          o.brand.toLowerCase().includes(searchTerm) || o.clothType.toLowerCase().includes(searchTerm)
        )
        filtered.sort((a, b) => {
          if (sortBy === 'name')     return a.name.localeCompare(b.name)
          if (sortBy === 'usage')    return b.usageCount - a.usageCount
          if (sortBy === 'date')     return new Date(b.dateAdded) - new Date(a.dateAdded)
          if (sortBy === 'favorite') return (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)
          return 0
        })
        return filtered
      }

      function renderOutfits(outfits, type) {
        const container = document.getElementById(`${type}-outfits`)
        container.innerHTML = ''
        if (outfits.length === 0) {
          container.innerHTML = '<p class="text-center stats-text col-span-full">No outfits found. Add some outfits to get started!</p>'
          return
        }
        outfits.forEach(o => container.appendChild(createOutfitElement(o, type)))
      }

      function createOutfitElement(outfit, type) {
        const div = document.createElement('div')
        div.className = 'outfit-item card p-4'

        const imgContainer = document.createElement('div')
        imgContainer.className = 'relative'

        const img = document.createElement('img')
        img.src = outfit.src; img.alt = outfit.name
        img.className = 'w-full h-40 object-cover rounded-md mb-2 cursor-grab'
        img.draggable = true
        img.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('application/json', JSON.stringify({ type, id: outfit.id, src: outfit.src, name: outfit.name, brand: outfit.brand, clothType: outfit.clothType, color: outfit.color }))
          e.target.style.opacity = '0.5'
        })
        img.addEventListener('dragend', (e) => { e.target.style.opacity = '1' })

        const addBtn = document.createElement('button')
        addBtn.className = 'add-preview-btn'
        addBtn.title = 'Add to preview'
        addBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
        addBtn.addEventListener('click', (e) => { e.stopPropagation(); addToPreview(type, outfit.id) })

        imgContainer.appendChild(img)
        imgContainer.appendChild(addBtn)

        const name = document.createElement('h3')
        name.className = 'font-semibold text-lg mb-1'; name.textContent = outfit.name

        const details = document.createElement('div')
        details.className = 'text-sm stats-text mb-2'
        details.innerHTML = `<div class="flex items-center mb-1"><span class="color-swatch" style="background-color:${outfit.color}"></span>${outfit.brand} • ${outfit.clothType}</div><div>Usage: ${outfit.usageCount} times</div>`

        const actions = document.createElement('div')
        actions.className = 'flex justify-between items-center mt-2'

        const favBtn = document.createElement('button')
        favBtn.className = `px-2 py-1 rounded text-xs ${outfit.isFavorite ? 'btn-accent' : 'btn-secondary'}`
        favBtn.textContent = outfit.isFavorite ? '❤️ Favorited' : '♡ Favorite'
        favBtn.addEventListener('click', () => toggleFavorite(type, outfit.id))

        const delBtn = document.createElement('button')
        delBtn.className = 'px-2 py-1 btn-secondary rounded text-xs'; delBtn.textContent = 'Delete'
        delBtn.addEventListener('click', () => deleteOutfit(type, outfit.id))

        actions.appendChild(favBtn); actions.appendChild(delBtn)
        div.appendChild(imgContainer); div.appendChild(name); div.appendChild(details); div.appendChild(actions)
        return div
      }

      function addToPreview(type, outfitId) {
        const outfits = JSON.parse(localStorage.getItem(`${type}Outfits`) || '[]')
        const outfit = outfits.find(o => String(o.id) === String(outfitId))
        if (!outfit) return
        outfit.usageCount++; outfit.lastWorn = new Date().toISOString()
        localStorage.setItem(`${type}Outfits`, JSON.stringify(outfits))
        const dropZone = document.getElementById(`${type}-drop`)
        dropZone.innerHTML = `<img src="${outfit.src}" class="max-h-full max-w-full object-contain">`
        dropZone.dataset.outfitName  = outfit.name
        dropZone.dataset.outfitBrand = outfit.brand
        dropZone.dataset.outfitType  = outfit.clothType
        dropZone.dataset.outfitColor = outfit.color
        dropZone.dataset.imageUrl    = outfit.src
        loadOutfits()
      }

      function toggleFavorite(type, outfitId) {
        const outfits = JSON.parse(localStorage.getItem(`${type}Outfits`) || '[]')
        const idx = outfits.findIndex(o => String(o.id) === String(outfitId))
        if (idx === -1) return
        outfits[idx].isFavorite = !outfits[idx].isFavorite
        localStorage.setItem(`${type}Outfits`, JSON.stringify(outfits))
        loadOutfits()
      }

      async function deleteOutfit(type, outfitId) {
        const outfits = JSON.parse(localStorage.getItem(`${type}Outfits`) || '[]')
        const idx = outfits.findIndex(o => String(o.id) === String(outfitId))
        if (idx === -1) return
        const outfitName = outfits[idx].name
        const confirmed = await Modal.confirm('Delete Outfit', `Are you sure you want to delete "${outfitName}"? This cannot be undone.`)
        if (confirmed) {
          outfits.splice(idx, 1)
          localStorage.setItem(`${type}Outfits`, JSON.stringify(outfits))
          loadOutfits()
          await Modal.alert('Outfit Deleted', `"${outfitName}" has been deleted.`, 'success')
        }
      }

      // ── Drag & drop ────────────────────────────────────────────────────────
      function handleDragOver(e)  { e.preventDefault(); e.currentTarget.classList.add('drag-over') }
      function handleDragLeave(e) { e.preventDefault(); e.currentTarget.classList.remove('drag-over') }
      function handleDrop(e) {
        e.preventDefault(); e.currentTarget.classList.remove('drag-over')
        const data = JSON.parse(e.dataTransfer.getData('application/json'))
        const dropZone = e.currentTarget
        if ((dropZone.id === 'upper-drop' && data.type === 'upper') || (dropZone.id === 'lower-drop' && data.type === 'lower')) {
          const outfits = JSON.parse(localStorage.getItem(`${data.type}Outfits`) || '[]')
          const idx = outfits.findIndex(o => String(o.id) === String(data.id))
          if (idx === -1) return
          outfits[idx].usageCount++; outfits[idx].lastWorn = new Date().toISOString()
          localStorage.setItem(`${data.type}Outfits`, JSON.stringify(outfits))
          dropZone.innerHTML = `<img src="${data.src}" class="max-h-full max-w-full object-contain">`
          dropZone.dataset.outfitName  = outfits[idx].name
          dropZone.dataset.outfitBrand = outfits[idx].brand
          dropZone.dataset.outfitType  = outfits[idx].clothType
          dropZone.dataset.outfitColor = outfits[idx].color
          dropZone.dataset.imageUrl    = data.src
          loadOutfits()
        }
      }

      // ── Combinations ───────────────────────────────────────────────────────
      async function saveCombination() {
        const upperImg = document.querySelector('#upper-drop img')
        const lowerImg = document.querySelector('#lower-drop img')
        if (!upperImg || !lowerImg) { await Modal.alert('Incomplete Outfit', 'Please add both an upper and lower outfit.', 'warning'); return }
        const name = await Modal.prompt('Save Combination', 'Enter a name for this outfit combination:', 'e.g., Casual Friday', 'My Outfit')
        if (!name) return
        const combinations = JSON.parse(localStorage.getItem('combinations') || '[]')
        combinations.push({ name, upperSrc: upperImg.src, lowerSrc: lowerImg.src, dateCreated: new Date().toISOString() })
        localStorage.setItem('combinations', JSON.stringify(combinations))
        loadOutfits(); clearPreview()
        await Modal.alert('Combination Saved!', 'Your outfit combination has been saved!', 'success')
      }

      function renderCombinations(combinations) {
        const container = document.getElementById('saved-combinations')
        container.innerHTML = ''
        if (combinations.length === 0) { container.innerHTML = '<p class="text-center stats-text">No saved combinations yet.</p>'; return }
        combinations.forEach((combo, index) => {
          const el = document.createElement('div')
          el.className = 'flex items-center justify-between p-3 card'
          el.innerHTML = `<div class="flex items-center space-x-3"><img src="${combo.upperSrc}" class="w-12 h-12 object-cover rounded"><img src="${combo.lowerSrc}" class="w-12 h-12 object-cover rounded"><div><h4 class="font-medium">${combo.name}</h4><p class="text-xs stats-text">Created: ${new Date(combo.dateCreated).toLocaleDateString()}</p></div></div><button class="delete-combination px-2 py-1 btn-secondary rounded text-xs" data-index="${index}">Delete</button>`
          container.appendChild(el)
        })
        document.querySelectorAll('.delete-combination').forEach(btn => {
          btn.addEventListener('click', function() { deleteCombination(parseInt(this.dataset.index)) })
        })
      }

      async function deleteCombination(index) {
        const combinations = JSON.parse(localStorage.getItem('combinations') || '[]')
        const comboName = combinations[index].name
        const confirmed = await Modal.confirm('Delete Combination', `Delete "${comboName}"?`)
        if (confirmed) {
          combinations.splice(index, 1)
          localStorage.setItem('combinations', JSON.stringify(combinations))
          loadOutfits()
          await Modal.alert('Deleted', `"${comboName}" has been deleted.`, 'success')
        }
      }

      function clearPreview() {
        document.getElementById('upper-drop').innerHTML = 'Drop Upper Here'
        document.getElementById('lower-drop').innerHTML = 'Drop Lower Here'
        const ws = document.getElementById('weather-suggestions')
        if (ws) ws.classList.add('hidden')
        ;['upper-drop','lower-drop'].forEach(id => {
          const el = document.getElementById(id)
          ;['data-outfit-name','data-outfit-brand','data-outfit-type','data-outfit-color','data-image-url'].forEach(a => el.removeAttribute(a))
        })
      }

      // ── Schedule ───────────────────────────────────────────────────────────
      async function scheduleOutfit() {
        const date      = document.getElementById('schedule-date').value
        const upperDrop = document.getElementById('upper-drop')
        const lowerDrop = document.getElementById('lower-drop')
        if (!date) { await Modal.alert('Date Required', 'Please select a date.', 'warning'); return }
        if (!upperDrop.dataset.imageUrl || !lowerDrop.dataset.imageUrl) { await Modal.alert('Incomplete Outfit', 'Add both upper and lower outfits first.', 'warning'); return }
        const userEmail = await Modal.prompt('Schedule Outfit', 'Please enter your email:', 'your-email@example.com')
        if (!userEmail) return
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) { await Modal.alert('Invalid Email', 'Enter a valid email address.', 'warning'); return }

        const payload = {
          email: userEmail, schedule_date: date,
          upper_name: upperDrop.dataset.outfitName, upper_brand: upperDrop.dataset.outfitBrand,
          upper_type: upperDrop.dataset.outfitType, upper_color: upperDrop.dataset.outfitColor, upper_image: upperDrop.dataset.imageUrl,
          lower_name: lowerDrop.dataset.outfitName, lower_brand: lowerDrop.dataset.outfitBrand,
          lower_type: lowerDrop.dataset.outfitType, lower_color: lowerDrop.dataset.outfitColor, lower_image: lowerDrop.dataset.imageUrl,
        }
        const scheduleBtn = document.getElementById('schedule-outfit')
        scheduleBtn.textContent = 'Scheduling...'; scheduleBtn.disabled = true
        try {
          const response = await fetch(`${BACKEND_CONFIG.BASE_URL}${BACKEND_CONFIG.SCHEDULE_ENDPOINT}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          const resData = await response.json()
          if (!response.ok) throw new Error(resData.error || `HTTP error! Status: ${response.status}`)
          await Modal.alert('Scheduled!', 'Your outfit is scheduled and email sent!', 'success')
        } catch (err) {
          await Modal.alert('Error', `Failed to schedule outfit: ${err.message}`, 'error')
        }
        scheduleBtn.textContent = 'Schedule Outfit'; scheduleBtn.disabled = false
      }

      // ── Statistics ─────────────────────────────────────────────────────────
      function updateStatistics(upperOutfits, lowerOutfits) {
        const allOutfits = [...upperOutfits, ...lowerOutfits]
        if (allOutfits.length === 0) {
          document.getElementById('stats-text').textContent = 'Add some outfits to see statistics.'
          if (usageChart) usageChart.destroy()
          if (favoritesChart) favoritesChart.destroy()
          return
        }
        const totalOutfits    = allOutfits.length
        const favoriteOutfits = allOutfits.filter(o => o.isFavorite).length
        const totalUsage      = allOutfits.reduce((s, o) => s + o.usageCount, 0)
        const avgUsage        = (totalUsage / totalOutfits).toFixed(1)
        const usageDistribution = { 'Never Used': 0, '1-5 Times': 0, '6-10 Times': 0, '10+ Times': 0 }
        allOutfits.forEach(o => {
          if (o.usageCount === 0)       usageDistribution['Never Used']++
          else if (o.usageCount <= 5)   usageDistribution['1-5 Times']++
          else if (o.usageCount <= 10)  usageDistribution['6-10 Times']++
          else                          usageDistribution['10+ Times']++
        })
        document.getElementById('stats-text').textContent = `Total Outfits: ${totalOutfits} | Favorites: ${favoriteOutfits} | Avg Usage: ${avgUsage} times`
        updateCharts(usageDistribution, { Favorites: favoriteOutfits, Regular: totalOutfits - favoriteOutfits })
      }

      function updateCharts(usageDist, favDist) {
        const Chart = window.Chart
        const usageCtx     = document.getElementById('usage-chart').getContext('2d')
        const favoritesCtx = document.getElementById('favorites-chart').getContext('2d')
        if (usageChart)     usageChart.destroy()
        if (favoritesChart) favoritesChart.destroy()
        usageChart = new Chart(usageCtx, { type: 'bar', data: { labels: Object.keys(usageDist), datasets: [{ label: 'Outfits by Usage', data: Object.values(usageDist), backgroundColor: ['rgba(72,39,144,0.6)','rgba(255,215,0,0.6)','rgba(244,211,94,0.6)','rgba(58,31,114,0.6)'], borderColor: ['rgb(72,39,144)','rgb(255,215,0)','rgb(244,211,94)','rgb(58,31,114)'], borderWidth: 1 }] }, options: { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Usage Distribution' } } } })
        favoritesChart = new Chart(favoritesCtx, { type: 'doughnut', data: { labels: Object.keys(favDist), datasets: [{ data: Object.values(favDist), backgroundColor: ['rgba(255,215,0,0.6)','rgba(72,39,144,0.6)'], borderColor: ['rgb(255,215,0)','rgb(72,39,144)'], borderWidth: 1 }] }, options: { responsive: true, plugins: { title: { display: true, text: 'Favorite Status' } } } })
      }

      // ── Notifications ──────────────────────────────────────────────────────
      function checkNotifications() {
        const today = new Date().toDateString()
        if (localStorage.getItem('lastNotification') !== today) {
          if (Notification.permission === 'granted') new Notification('Virtual Wardrobe', { body: 'Welcome back! Check your scheduled outfits for today.' })
          else if (Notification.permission === 'default') Notification.requestPermission()
          localStorage.setItem('lastNotification', today)
        }
      }
    } // end initApp
  }, [])

  return (
    <div dangerouslySetInnerHTML={{ __html: `
      <div id="modal-overlay" class="modal-overlay">
        <div id="modal" class="modal">
          <div id="modal-header" class="modal-header"><h3 id="modal-title" class="modal-title">Modal Title</h3></div>
          <div id="modal-body" class="modal-body">
            <p id="modal-message" class="modal-message">Modal message will appear here.</p>
            <input type="text" id="modal-input" class="modal-input hidden" placeholder="Enter value..." />
          </div>
          <div id="modal-footer" class="modal-footer">
            <button id="modal-cancel" class="btn-secondary px-4 py-2 rounded-lg transition-colors">Cancel</button>
            <button id="modal-confirm" class="btn-primary px-4 py-2 rounded-lg transition-colors">Confirm</button>
          </div>
        </div>
      </div>

      <div class="container mx-auto p-4" style="padding-top: 2rem;">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold" style="color:#1a1a1a">Virtual Wardrobe</h1>
          <div class="flex gap-2 flex-wrap">
            <input type="text" id="global-search" placeholder="Search outfits..." class="form-input p-2 w-48" />
            <button id="weather-btn" class="btn-accent px-4 py-2 rounded-lg transition-colors">Get Weather Suggestions</button>
          </div>
        </div>

        <div class="flex flex-col lg:flex-row gap-6">
          <div class="w-full lg:w-1/2 space-y-6">
            <div class="card p-6">
              <h2 class="text-xl font-semibold mb-4">Upper Outfits</h2>
              <div class="flex flex-wrap gap-2 mb-4">
                <button id="add-upper" class="btn-primary px-4 py-2 rounded-lg transition-colors">Add Upper Outfit</button>
                <input type="file" id="upper-file" accept="image/*" class="hidden" />
                <input type="text" id="upper-name" placeholder="Name" class="form-input w-32" />
                <input type="text" id="upper-brand" placeholder="Brand" class="form-input w-24" />
                <input type="text" id="upper-cloth" placeholder="Material" class="form-input w-28" />
              </div>
              <div class="flex flex-wrap gap-2 mb-4">
                <select id="upper-filter" class="form-select"><option value="All">All Categories</option><option value="Casual">Casual</option><option value="Formal">Formal</option><option value="Party">Party</option><option value="Work">Work</option><option value="Sports">Sports</option></select>
                <select id="upper-season-filter" class="form-select"><option value="All">All Seasons</option><option value="Spring">Spring</option><option value="Summer">Summer</option><option value="Fall">Fall</option><option value="Winter">Winter</option></select>
                <select id="upper-sort" class="form-select"><option value="name">Sort by Name</option><option value="usage">Sort by Usage</option><option value="date">Sort by Date</option><option value="favorite">Sort by Favorite</option></select>
              </div>
              <div class="loading-spinner" id="upper-loading"></div>
              <div id="upper-outfits" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
            </div>

            <div class="card p-6">
              <h2 class="text-xl font-semibold mb-4">Lower Outfits</h2>
              <div class="flex flex-wrap gap-2 mb-4">
                <button id="add-lower" class="btn-primary px-4 py-2 rounded-lg transition-colors">Add Lower Outfit</button>
                <input type="file" id="lower-file" accept="image/*" class="hidden" />
                <input type="text" id="lower-name" placeholder="Name" class="form-input w-32" />
                <input type="text" id="lower-brand" placeholder="Brand" class="form-input w-24" />
                <input type="text" id="lower-cloth" placeholder="Material" class="form-input w-28" />
              </div>
              <div class="flex flex-wrap gap-2 mb-4">
                <select id="lower-filter" class="form-select"><option value="All">All Categories</option><option value="Casual">Casual</option><option value="Formal">Formal</option><option value="Party">Party</option><option value="Work">Work</option><option value="Sports">Sports</option></select>
                <select id="lower-season-filter" class="form-select"><option value="All">All Seasons</option><option value="Spring">Spring</option><option value="Summer">Summer</option><option value="Fall">Fall</option><option value="Winter">Winter</option></select>
                <select id="lower-sort" class="form-select"><option value="name">Sort by Name</option><option value="usage">Sort by Usage</option><option value="date">Sort by Date</option><option value="favorite">Sort by Favorite</option></select>
              </div>
              <div class="loading-spinner" id="lower-loading"></div>
              <div id="lower-outfits" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
            </div>
          </div>

          <div class="w-full lg:w-1/2 space-y-6">
            <div class="card p-6">
              <h2 class="text-xl font-semibold mb-4">Preview Outfit</h2>
              <div id="upper-drop" class="drop-zone border-2 border-dashed p-4 mb-4 flex justify-center items-center h-48 rounded-lg" style="border-color:#dedede">Drop Upper Here</div>
              <div id="lower-drop" class="drop-zone border-2 border-dashed p-4 mb-4 flex justify-center items-center h-48 rounded-lg" style="border-color:#dedede">Drop Lower Here</div>
              <div class="flex flex-wrap gap-2 mb-4">
                <button id="save-combination" class="btn-primary px-4 py-2 rounded-lg transition-colors">Save Combination</button>
                <button id="clear-preview" class="btn-secondary px-4 py-2 rounded-lg transition-colors">Clear Preview</button>
                <button id="schedule-outfit" class="btn-accent px-4 py-2 rounded-lg transition-colors">Schedule Outfit</button>
                <input type="date" id="schedule-date" class="form-input p-2" />
              </div>
              <div id="weather-suggestions" class="mt-4 p-4 rounded-lg hidden" style="background-color:rgba(255,215,0,0.1)">
                <h3 class="font-semibold">Weather-Based Suggestions</h3>
                <p id="weather-info"></p>
              </div>
            </div>

            <div class="card p-6">
              <h2 class="text-xl font-semibold mb-4">Saved Combinations</h2>
              <div id="saved-combinations" class="space-y-4 max-h-64 overflow-y-auto"></div>
            </div>

            <div class="card p-6">
              <h2 class="text-xl font-semibold mb-4">Statistical Insights</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><canvas id="usage-chart" width="400" height="200"></canvas></div>
                <div><canvas id="favorites-chart" width="400" height="200"></canvas></div>
              </div>
              <p id="stats-text" class="mt-4 text-center stats-text"></p>
            </div>
          </div>
        </div>
      </div>
    ` }} />
  )
}