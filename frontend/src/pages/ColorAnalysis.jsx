import { useEffect, useRef, useState } from 'react'

export default function ColorAnalysis() {
  const initialized = useRef(false)
  const [result, setResult] = useState(null) // { pred_class, img_path, palette }
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Inject Modal logic after mount
    const fileInput = document.getElementById('fileInput')
    const fileNameDisplay = document.getElementById('fileName')
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        fileNameDisplay.textContent = fileInput.files.length > 0
          ? 'Selected file: ' + fileInput.files[0].name : ''
      })
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const fileInput = document.getElementById('fileInput')
    const file = fileInput?.files[0]
    if (!file) return

    setLoading(true)
    setResult(null)
    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/color-analysis', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err) {
      modalAlert('Error', err.message || 'Analysis failed. Please try again.', 'error')
    }
    setLoading(false)
  }

  const fetchColorProducts = async () => {
    const gender = document.getElementById('gender')?.value
    const category = document.getElementById('category')?.value
    const color = document.getElementById('color_select')?.value
    const container = document.getElementById('products_container')
    const spinner = document.getElementById('spinner')

    if (!category || !color) {
      modalAlert('Missing Input', 'Please enter a category and select a color.', 'warning')
      return
    }

    container.innerHTML = ''
    spinner.style.display = 'block'

    try {
      const response = await fetch('/api/get-color-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gender, category, color }),
      })
      const products = await response.json()
      spinner.style.display = 'none'

      if (!Array.isArray(products) || products.length === 0) {
        container.innerHTML = '<p>No products found.</p>'
        return
      }

      products.forEach((product) => {
        const card = document.createElement('div')
        card.className = 'product'
        card.innerHTML = `
          <img src="${product.image}" alt="${product.title}">
          <a href="${product.link}" target="_blank">${product.title}</a>
          <div class="price">${product.price || 'N/A'}</div>
          <div class="store">${product.source || ''}</div>
          <button class="save-btn" style="margin-top:10px;padding:8px 14px;background:#482790;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">
            Save to Wardrobe
          </button>
        `
        card.querySelector('.save-btn').addEventListener('click', () => saveScrapedItemToWardrobe(product))
        container.appendChild(card)
      })
    } catch (error) {
      spinner.style.display = 'none'
      modalAlert('Server Error', 'Unable to load products. Please try again.', 'error')
      container.innerHTML = '<p>Error loading products.</p>'
    }
  }

  // Expose fetchColorProducts to window so onclick in HTML works
  useEffect(() => {
    window.fetchColorProducts = fetchColorProducts
    return () => { delete window.fetchColorProducts }
  }, [result])

  return (
    <>
      <style>{`
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f9f5ec; color: #1a1a1a; }
        h1 { margin-bottom: 30px; }
        .upload-card { display: inline-block; width: min(400px, 90vw); padding: 40px 20px; background-color: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); margin-bottom: 30px; transition: 0.3s; }
        .upload-card:hover { box-shadow: 0 15px 35px rgba(0,0,0,0.15); }
        .file-input { display: none; }
        .file-label { display: inline-block; padding: 15px 30px; background-color: #482790; color: #f9f5ec; font-weight: bold; border-radius: 8px; cursor: pointer; transition: 0.3s; }
        .file-label:hover { background-color: #3a1f72; }
        .file-name { margin-top: 10px; font-size: 0.9rem; color: #333; }
        .btn-predict { display: inline-block; margin-top: 20px; padding: 12px 25px; background-color: #ffd700; color: #1a1a1a; font-weight: bold; border-radius: 8px; cursor: pointer; border: none; transition: 0.3s; font-size: 1rem; }
        .btn-predict:hover { background-color: #f4d35e; }
        .uploaded-image { max-width: 300px; margin: 20px auto; border-radius: 12px; border: 1px solid #ccc; display: block; }
        .color-palette { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 20px; gap: 15px; }
        .color-box { width: 100px; height: 60px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .color-name { margin-top: 5px; font-size: 0.85rem; color: #1a1a1a; text-align: center; }
        .filter-bar { margin-top: 20px; display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; }
        .filter-bar select, .filter-bar input { padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 0.95rem; max-width: 100%; }
        button.fetch-btn { padding: 10px 20px; background-color: #482790; color: #f9f5ec; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.3s; }
        button.fetch-btn:hover { background-color: #3a1f72; }
        #products_container { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; max-width: 1000px; margin: 2rem auto; }
        .product { border: 1px solid #ddd; border-radius: 0.5rem; padding: 0.5rem; background: white; text-align: center; }
        .product img { width: 100%; height: 180px; object-fit: cover; border-radius: 0.5rem; }
        .product a { text-decoration: none; color: #333; font-weight: bold; display: block; margin: 0.5rem auto; font-size: 0.85rem; text-align: center; }
        .product .price { color: green; font-weight: bold; font-size: 0.85rem; }
        .product .store { font-size: 0.8rem; color: #666; }
        #spinner { display: none; font-size: 1.2rem; margin-top: 20px; color: #482790; font-weight: bold; animation: pulse 1s infinite; }
        @keyframes pulse { 0%{opacity:0.4} 50%{opacity:1} 100%{opacity:0.4} }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; opacity: 0; visibility: hidden; transition: 0.3s ease; }
        .modal-overlay.active { opacity: 1; visibility: visible; }
        .modal { background: #fff; border-radius: 1rem; overflow: hidden; transform: translateY(20px); transition: 0.3s ease; max-width: 400px; width: 90%; }
        .modal-overlay.active .modal { transform: translateY(0); }
        .modal-header { background: linear-gradient(135deg, #482790, #3a1f72); color: white; padding: 1.2rem; }
        .modal-body { padding: 1.5rem; }
        .modal-footer { padding: 1rem; background: #f8fafc; display: flex; justify-content: flex-end; gap: 1rem; }
        .ca-btn-primary { background-color: #482790; color: #f9f5ec; padding: 0.5rem 1rem; border-radius: 0.5rem; transition: 0.3s ease; border: none; cursor: pointer; }
        .ca-btn-primary:hover { background-color: #3a1f72; }
        .ca-btn-secondary { background-color: transparent; color: #482790; border: 2px solid #482790; padding: 0.5rem 1rem; border-radius: 0.5rem; transition: 0.3s ease; cursor: pointer; }
        .ca-btn-secondary:hover { background-color: #482790; color: #f9f5ec; }
        @media (max-width: 600px) {
          body { padding: 20px 10px; }
          .upload-card { width: 95vw !important; padding: 20px 10px; }
          .filter-bar { flex-direction: column; align-items: center; }
          .filter-bar select, .filter-bar input { width: 90%; }
          #products_container { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
          .color-palette { gap: 8px; }
          .color-box { width: 70px; height: 45px; }
        }
        .loading-bar { margin: 2rem auto; border: 6px solid #f3f3f3; border-top: 6px solid #482790; border-radius: 50%; width: 60px; height: 60px; animation: spin 1s linear infinite; }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      `}</style>

      {/* Modal */}
      <div id="modal-overlay" className="modal-overlay">
        <div id="modal" className="modal">
          <div id="modal-header" className="modal-header">
            <h3 id="modal-title" className="modal-title">Modal Title</h3>
          </div>
          <div id="modal-body" className="modal-body">
            <p id="modal-message" className="modal-message"></p>
          </div>
          <div id="modal-footer" className="modal-footer">
            <button id="modal-cancel" className="ca-btn-secondary">OK</button>
            <button id="modal-confirm" className="ca-btn-primary" style={{ display: 'none' }}>Confirm</button>
          </div>
        </div>
      </div>

            <h1 style={{ fontSize:'2rem', fontWeight:'bold', marginBottom:'30px', color:'#1a1a1a' }}>Personal Color Analysis</h1>

      {/* Upload card */}
      <div className="upload-card">
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          <input type="file" name="image" id="fileInput" className="file-input" accept="image/*" required />
          <label htmlFor="fileInput" className="file-label">Choose Image</label>
          <div id="fileName" className="file-name"></div>
          <br />
          <button type="submit" className="btn-predict">
            Predict my color palette
          </button>
        </form>
      </div>

      {/* Loading spinner */}
      {loading && <div className="loading-bar" />}

      {/* Results */}
      {result && (
        <div className="result-container">
          <h2>Predicted Undertone: <strong style={{ color: '#482790' }}>{result.pred_class}</strong></h2>
          <img src={result.img_path} alt="Uploaded" className="uploaded-image" />

          <h3 style={{ marginTop: '1.5rem' }}>Suggested Seasonal Palette:</h3>
          <div className="color-palette">
            {result.palette.map((color, i) => (
              <div key={i}>
                <div className="color-box" style={{ backgroundColor: color.hex }} />
                <div className="color-name">{color.name}</div>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: '2rem' }}>Find Products in Your Palette Colors</h3>
          <div className="filter-bar">
            <select id="gender">
              <option value="men">Men</option>
              <option value="women">Women</option>
            </select>
            <input id="category" type="text" placeholder="e.g. shirts" />
            <select id="color_select">
              {result.palette.map((color, i) => (
                <option key={i} value={color.name.toLowerCase()}>{color.name}</option>
              ))}
            </select>
            <button type="button" className="fetch-btn" onClick={fetchColorProducts}>
              Get Products
            </button>
          </div>

          <div id="spinner">⏳ Loading products...</div>
          <div id="products_container"></div>
        </div>
      )}
    </>
  )
}

// ── Helpers (outside component, no re-render needed) ──────────────────────────
function saveScrapedItemToWardrobe(product) {
  if (!product || !product.title || !product.image) {
    modalAlert('Error', 'Product data is incomplete. Cannot save.', 'error')
    return
  }
  const lowerKeywords = ['jeans','pants','trousers','shorts','jogger','pyjama','skirt','leggings']
  const type = lowerKeywords.some(w => product.title.toLowerCase().includes(w)) ? 'lower' : 'upper'
  const key = type === 'upper' ? 'upperOutfits' : 'lowerOutfits'
  const item = {
    id: Date.now() + Math.random(),
    src: product.image,
    name: product.title,
    brand: product.source || 'Unknown',
    clothType: type === 'upper' ? 'Topwear' : 'Bottomwear',
    color: '#000000',
    usageCount: 0,
    isFavorite: false,
    dateAdded: new Date().toISOString(),
    lastWorn: null,
    scheduledDates: [],
  }
  const existing = JSON.parse(localStorage.getItem(key) || '[]')
  existing.push(item)
  localStorage.setItem(key, JSON.stringify(existing))
  modalAlert('Saved!', 'Item saved to your Virtual Wardrobe.', 'success')
}

function modalAlert(title, message, type = 'info') {
  const overlay   = document.getElementById('modal-overlay')
  const modal     = document.getElementById('modal')
  const titleEl   = document.getElementById('modal-title')
  const messageEl = document.getElementById('modal-message')
  const cancelBtn = document.getElementById('modal-cancel')
  const confirmBtn = document.getElementById('modal-confirm')
  if (!overlay) return
  titleEl.textContent   = title
  messageEl.textContent = message
  confirmBtn.style.display = 'none'
  cancelBtn.textContent = 'OK'
  modal.className = 'modal'
  if (type === 'success') modal.classList.add('modal-success')
  if (type === 'error')   modal.classList.add('modal-error')
  if (type === 'warning') modal.classList.add('modal-warning')
  overlay.classList.add('active')
  cancelBtn.onclick = () => overlay.classList.remove('active')
  overlay.onclick   = (e) => { if (e.target === overlay) overlay.classList.remove('active') }
}