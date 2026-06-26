import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'

export default function Home() {
  useEffect(() => {
    document.getElementById('year').textContent = new Date().getFullYear()
  }, [])

  return (
    <>
      {/* Robot mascot */}
      <div id="robot-container" aria-hidden="true">
        <div id="sketch-board-con">
          <div id="sketch-board">
            <div id="head">
              <div id="lens"><div id="upper-shadow"></div></div>
              <div id="rect"></div>
              <div id="eyes"></div>
            </div>
            <div id="ear">
              <div id="ear-antenna"></div>
              <div id="small-cap"></div>
            </div>
            <div id="body">
              <div id="shadow-box"></div>
              <div id="pocket-area"><div id="pocket"></div></div>
            </div>
            <div id="hands">
              <div className="hand"></div>
              <div className="hand"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="logo-container">
        <img src="/logo.png" alt="Zenvia Logo" className="logo" />
      </div>

      {/* Hero */}
      <section className="hero-section">
        <div
          className="hero-background"
          style={{ backgroundImage: "url('https://res.cloudinary.com/dvet5mnyr/image/upload/v1781356751/fashion-hero_nmg8nd.jpg')" }}
        />
        <div className="hero-content">
          <div className="hero-icon">
            <svg className="sparkles-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h1 className="hero-title">Fashion <span className="gradient-text">Forward</span></h1>
          <p className="hero-subtitle">
            Discover your PerfectFit, personalized color palette, a smart virtual wardrobe,
            and effortless style guidance with FashionBot
          </p>
        </div>
      </section>

      {/* Feature cards */}
      <section className="cards-section">
        <div className="container">
          <div className="cards-grid">
            <div className="card feature-card">
              <div className="card-header">
                <div className="card-icon-wrapper">
                  <div className="card-icon-bg icon-primary-bg">
                    <svg className="card-icon" fill="none" stroke="#482790" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <h2 className="card-title">Perfect Fit Finder</h2>
                <p className="card-description">Get your ideal t-shirt size with our sizing technology</p>
              </div>
              <div className="card-content">
                <p className="card-text">
                  Say goodbye to ill-fitting clothes. Our smart sizing algorithm analyzes
                  your measurements to recommend the perfect size every time.
                </p>
                <Link to="/size-prediction" className="btn btn-primary">Find My Size</Link>
              </div>
            </div>

            <div className="card feature-card">
              <div className="card-header">
                <div className="card-icon-wrapper">
                  <div className="card-icon-bg icon-accent-bg">
                    <svg className="card-icon" fill="none" stroke="#b8860b" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </div>
                </div>
                <h2 className="card-title">Color Harmony</h2>
                <p className="card-description">Discover your personal color palette</p>
              </div>
              <div className="card-content">
                <p className="card-text">
                  Unlock the colors that complement your skin tone. Our personal color analysis
                  reveals your perfect seasonal palette.
                </p>
                <Link to="/color-analysis" className="btn btn-accent">Discover My Colors</Link>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <div className="card feature-card">
              <div className="card-header">
                <div className="card-icon-wrapper">
                  <div className="card-icon-bg icon-primary-bg">
                    <svg className="card-icon" fill="none" stroke="#482790" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M3 7v14h18V7H3zm0-4h18v4H3V3z" />
                    </svg>
                  </div>
                </div>
                <h2 className="card-title">Virtual Wardrobe</h2>
                <p className="card-description">Organize and visualize your outfits digitally</p>
              </div>
              <div className="card-content">
                <p className="card-text">
                  Mix, match, and plan your outfits effortlessly. Create stylish combinations
                  and track your wardrobe items.
                </p>
                <Link to="/virtual-wardrobe" className="btn btn-primary">Explore Wardrobe</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Link to="/fashionbot" className="chat-button">💬 FashionBot</Link>

      <footer className="footer">
        <p className="footer-text">© <span id="year"></span> Zenvia. All rights reserved.</p>
      </footer>
    </>
  )
}
