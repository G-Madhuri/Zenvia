import { useEffect, useRef, useState } from 'react'

export default function Camera() {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const intervalRef = useRef(null)
  const [status, setStatus]   = useState('Starting camera...')
  const [tempSize, setTempSize] = useState(null)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let stream = null

    // Reset backend state so previous session's locked size is cleared
    fetch('/api/reset-capture', { method: 'POST' }).catch(() => {})

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width:       { ideal: 640 },
            height:      { ideal: 480 },
            facingMode:  'user',
            zoom:        1,
            focusMode:   'manual',
            exposureMode:'manual',
          }
        })

        // After getting stream, lock zoom to 1 if browser supports it
        const track = stream.getVideoTracks()[0]
        if (track && typeof track.applyConstraints === 'function') {
          try {
            await track.applyConstraints({
              advanced: [{ zoom: 1, focusMode: 'manual' }]
            })
          } catch (_) { /* browser may not support, ignore */ }
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setStatus('Stand back so your full body is visible...')
          startSending()
        }
      } catch (err) {
        setError('Camera access denied. Please allow camera permission and try again.')
      }
    }

    function startSending() {
      intervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return

        const canvas  = canvasRef.current
        const video   = videoRef.current
        canvas.width  = video.videoWidth  || 640
        canvas.height = video.videoHeight || 480

        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]

        try {
          const res  = await fetch('/api/process-frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frame: base64 })
          })
          const data = await res.json()

          if (data.temp_size) {
            setTempSize(data.temp_size)
            setStatus(`Measuring... Temp Size: ${data.temp_size}`)
          }

          if (data.stable && data.size) {
            clearInterval(intervalRef.current)
            // Stop camera stream
            if (stream) stream.getTracks().forEach(t => t.stop())
            setStatus(`Locked! Size: ${data.size}`)
            setTimeout(() => {
              window.location.href = `${window.location.origin}/result?size=${data.size}&shoulder=${data.shoulder}&torso=${data.torso}`
            }, 800)
          }

          if (data.warning) setStatus(data.warning)

        } catch (e) {
          console.error('[frame error]', e)
        }
      }, 500) // send a frame every 500ms
    }

    startCamera()

    return () => {
      clearInterval(intervalRef.current)
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  return (
    <div style={{ background: '#f9f5ec', textAlign: 'center', fontFamily: 'sans-serif', minHeight: '100vh' }}>
      <h1 style={{ marginTop: '2rem', color: '#482790', fontSize: '2rem', fontWeight: 'bold' }}>
        Stay still while we capture your fit...
      </h1>

      <p style={{ color: '#482790', marginTop: '0.5rem', fontWeight: 600, fontSize: '1.1rem' }}>
        {status}
      </p>

      {error && (
        <p style={{ color: 'red', margin: '1rem auto', maxWidth: 500 }}>{error}</p>
      )}

      {/* Live webcam feed from browser */}
      <div style={{ width: '80%', maxWidth: 640, height: 480, margin: '1.5rem auto 0', overflow: 'hidden', borderRadius: '1rem', background: '#000', position: 'relative' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          muted
          playsInline
        />
        {tempSize && (
          <div style={{
            position: 'absolute', top: 16, left: 16,
            background: 'rgba(0,0,0,0.6)', color: '#00ff00',
            padding: '6px 14px', borderRadius: 8,
            fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 'bold'
          }}>
            Temp Size: {tempSize}
          </div>
        )}
      </div>

      {/* Hidden canvas used to extract frames */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <p style={{ color: '#888', marginTop: '1rem', fontSize: '0.9rem' }}>
        Make sure your full body from head to hips is visible. Keep still for a few seconds.
      </p>
    </div>
  )
}