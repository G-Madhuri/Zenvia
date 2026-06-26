import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

function saveToWardrobe(product) {
  const lowerKeywords = ['jeans','pants','trousers','shorts','jogger','pyjama','skirt','leggings']
  const type = lowerKeywords.some(w => (product.title||'').toLowerCase().includes(w)) ? 'lower' : 'upper'
  const key  = type === 'upper' ? 'upperOutfits' : 'lowerOutfits'
  const item = {
    id: Date.now() + Math.random(), src: product.image, name: product.title,
    brand: product.source || 'Unknown', clothType: type === 'upper' ? 'Topwear' : 'Bottomwear',
    color: '#000000', usageCount: 0, isFavorite: false,
    dateAdded: new Date().toISOString(), lastWorn: null, scheduledDates: [],
  }
  const existing = JSON.parse(localStorage.getItem(key) || '[]')
  existing.push(item)
  localStorage.setItem(key, JSON.stringify(existing))
}

function modalAlert(title, message, type = 'info') {
  const overlay    = document.getElementById('r-modal-overlay')
  const modal      = document.getElementById('r-modal')
  const titleEl    = document.getElementById('r-modal-title')
  const messageEl  = document.getElementById('r-modal-message')
  const cancelBtn  = document.getElementById('r-modal-cancel')
  const confirmBtn = document.getElementById('r-modal-confirm')
  if (!overlay) return
  titleEl.textContent   = title
  messageEl.textContent = message
  confirmBtn.style.display = 'none'
  cancelBtn.textContent = 'OK'
  modal.className = 'r-modal'
  if (type === 'success') modal.classList.add('r-modal-success')
  if (type === 'error')   modal.classList.add('r-modal-error')
  if (type === 'warning') modal.classList.add('r-modal-warning')
  overlay.classList.add('active')
  cancelBtn.onclick = () => overlay.classList.remove('active')
  overlay.onclick   = (e) => { if (e.target === overlay) overlay.classList.remove('active') }
}

export default function Result() {
  // Read size data from URL query params — e.g. /result?size=M&shoulder=42.3&torso=55.1
  const [searchParams] = useSearchParams()
  const size     = searchParams.get('size')
  const shoulder = searchParams.get('shoulder')
  const torso    = searchParams.get('torso')

  const [gender,   setGender]   = useState('')
  const [category, setCategory] = useState('')
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(false)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!gender || !category) return
    setLoading(true)
    setProducts([])
    try {
      const res = await fetch('/api/get-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gender, category, size }),
      })
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      modalAlert('Error', 'Could not load products.', 'error')
    }
    setLoading(false)
  }

  const handleSave = (product) => {
    if (!product?.title || !product?.image) {
      modalAlert('Error', 'Product data is incomplete.', 'error')
      return
    }
    saveToWardrobe(product)
    modalAlert('Saved!', 'Item saved to your Virtual Wardrobe.', 'success')
  }

  if (!size) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', fontFamily: 'sans-serif', background: '#f9f5ec', minHeight: '100vh' }}>
        <h2 style={{ color: '#482790' }}>Measurement not ready.</h2>
        <p style={{ color: '#666', margin: '1rem 0' }}>Please stand back so your full body is visible and try again.</p>
        <a href="/size-prediction" style={{ display: 'inline-block', padding: '0.75rem 2rem', background: '#482790', color: '#f9f5ec', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
          Try Again
        </a>
      </div>
    )
  }

  return (
    <div style={{ background: '#f9f5ec', minHeight: '100vh', fontFamily: 'sans-serif', textAlign: 'center', padding: '0 1rem 4rem' }}>

      {/* Modal */}
      <div id="r-modal-overlay" className="r-modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000, opacity:0, visibility:'hidden', transition:'0.3s ease' }}>
        <div id="r-modal" className="r-modal" style={{ background:'#fff', borderRadius:'1rem', overflow:'hidden', transform:'translateY(20px)', transition:'0.3s ease', maxWidth:400, width:'90%' }}>
          <div style={{ background:'linear-gradient(135deg,#482790,#3a1f72)', color:'white', padding:'1.2rem' }}>
            <h3 id="r-modal-title" style={{ margin:0 }}>Title</h3>
          </div>
          <div style={{ padding:'1.5rem' }}>
            <p id="r-modal-message" style={{ color:'#666' }}></p>
          </div>
          <div style={{ padding:'1rem', background:'#f8fafc', display:'flex', justifyContent:'flex-end', gap:'1rem' }}>
            <button id="r-modal-cancel" style={{ background:'transparent', color:'#482790', border:'2px solid #482790', padding:'0.5rem 1rem', borderRadius:'0.5rem', cursor:'pointer' }}>OK</button>
            <button id="r-modal-confirm" style={{ display:'none' }}>Confirm</button>
          </div>
        </div>
      </div>

            <div style={{ textAlign:'left', padding:'1.5rem 0 0 1.5rem' }}><a href="/" style={{ color:'#482790', fontWeight:600, fontSize:'1rem', textDecoration:'none' }}>← Home</a></div>
      <h1 style={{ color: '#482790', marginTop: '0.5rem', fontSize: '2rem', fontWeight: 'bold' }}>Your Estimated T-Shirt Size</h1>

      <div style={{ margin: '1rem auto', background: '#ffd700', color: '#1a1a1a', padding: '1rem 2rem', fontSize: '2rem', fontWeight: 'bold', borderRadius: '1rem', display: 'inline-block' }}>
        {size}
      </div>

      <p style={{ marginTop: '0.5rem', color: '#555' }}>
        Shoulder: {shoulder} cm &nbsp;|&nbsp; Torso: {torso} cm
      </p>

      <form onSubmit={handleSearch} style={{ margin: '2rem 0', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <select value={gender} onChange={e => setGender(e.target.value)}
          style={{ padding: '0.5rem 1rem', fontSize: '1rem', borderRadius: '0.5rem', border: '1px solid #ccc' }} required>
          <option value="">Select Gender</option>
          <option value="Men">Men</option>
          <option value="Women">Women</option>
        </select>

        <select value={category} onChange={e => setCategory(e.target.value)}
          style={{ padding: '0.5rem 1rem', fontSize: '1rem', borderRadius: '0.5rem', border: '1px solid #ccc' }} required>
          <option value="">Select Category</option>
          <option value="T-shirts">T-shirts</option>
          <option value="Shirts">Shirts</option>
          <option value="Jackets">Jackets</option>
        </select>

        <button type="submit" style={{ padding: '0.5rem 1.5rem', fontSize: '1rem', fontWeight: 600, background: '#482790', color: '#f9f5ec', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
          Show Products
        </button>
      </form>

      {loading && (
        <div style={{ margin: '2rem auto', width: 40, height: 40, border: '4px solid #f3f3f3', borderTop: '4px solid #482790', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      )}

      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}} @media(max-width:600px){form{flex-direction:column;align-items:center} form select,form button{width:90%;max-width:300px}} {0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}} .r-modal-overlay.active{opacity:1!important;visibility:visible!important} .r-modal-overlay.active .r-modal{transform:translateY(0)!important}`}</style>

      {!loading && products.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '1rem', maxWidth: 1000, margin: '2rem auto' }}>
          {products.map((p, i) => (
            <div key={i} style={{ border: '1px solid #ddd', borderRadius: '0.5rem', padding: '0.5rem', background: 'white', textAlign: 'center' }}>
              <img src={p.image} alt={p.title} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: '0.5rem' }} />
              <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#333', fontWeight: 'bold', display: 'block', margin: '0.5rem 0', fontSize: '0.85rem' }}>{p.title}</a>
              <div style={{ color: 'green', fontWeight: 'bold', fontSize: '0.85rem' }}>{p.price || 'N/A'}</div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>{p.source || ''}</div>
              <button onClick={() => handleSave(p)}
                style={{ marginTop: 10, padding: '8px 16px', background: '#482790', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                Save to Wardrobe
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && products.length === 0 && category && (
        <p style={{ color: '#888', marginTop: '1rem' }}>No products found.</p>
      )}
    </div>
  )
}