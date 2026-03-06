import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';

const OCRTest: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [recognizedWeight, setRecognizedWeight] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [manualWeight, setManualWeight] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Kamera starten
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Rückkamera auf Mobilgeräten
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Fehler beim Zugriff auf die Kamera:', error);
      alert('Kamera-Zugriff verweigert. Bitte verwenden Sie den Datei-Upload.');
    }
  };

  // Kamera stoppen
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsCameraActive(false);
    }
  };

  // Foto aufnehmen
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (context) {
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        setImage(imageData);
        stopCamera();
        processImage(imageData);
      }
    }
  };

  // Bild von Datei laden
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        setImage(imageData);
        processImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  // Gewicht aus Text extrahieren
  const extractWeight = (text: string): string => {
    // Entferne Leerzeichen und normalisiere
    const normalized = text.replace(/\s/g, '');

    // Suche nach Zahlen mit Dezimaltrennzeichen (Komma oder Punkt)
    // Typische Formate: 12.45, 12,45, 12.4, 12,4, 12
    const patterns = [
      /(\d+[.,]\d+)/g,  // Mit Dezimalstellen
      /(\d+)/g,         // Ganze Zahlen
    ];

    for (const pattern of patterns) {
      const matches = normalized.match(pattern);
      if (matches && matches.length > 0) {
        // Nimm die erste gefundene Zahl
        let weight = matches[0].replace(',', '.');
        return weight;
      }
    }

    return '';
  };

  // OCR durchführen
  const processImage = async (imageData: string) => {
    setIsProcessing(true);
    setExtractedText('');
    setRecognizedWeight('');
    setConfidence(0);
    setShowManualInput(false);

    try {
      const result = await Tesseract.recognize(imageData, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Fortschritt: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      const text = result.data.text;
      const conf = result.data.confidence;

      setExtractedText(text);
      setConfidence(conf);

      const weight = extractWeight(text);
      setRecognizedWeight(weight);
      setManualWeight(weight);

      console.log('OCR Text:', text);
      console.log('Erkanntes Gewicht:', weight);
      console.log('Confidence:', conf);

    } catch (error) {
      console.error('OCR Fehler:', error);
      alert('Fehler beim Verarbeiten des Bildes. Bitte versuchen Sie es erneut.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Gewicht bestätigen
  const confirmWeight = () => {
    alert(`Gewicht bestätigt: ${manualWeight} kg`);
    resetForm();
  };

  // Formular zurücksetzen
  const resetForm = () => {
    setImage(null);
    setExtractedText('');
    setRecognizedWeight('');
    setConfidence(0);
    setManualWeight('');
    setShowManualInput(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
              <h4 className="mb-0">OCR Waagen-Test</h4>
            </div>
            <div className="card-body">

              {/* Kamera-Vorschau */}
              {isCameraActive && (
                <div className="mb-3">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-100 rounded"
                    style={{ maxHeight: '400px', objectFit: 'cover' }}
                  />
                  <div className="d-grid gap-2 mt-2">
                    <button
                      className="btn btn-success btn-lg"
                      onClick={capturePhoto}
                    >
                      📸 Foto aufnehmen
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={stopCamera}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}

              {/* Versteckter Canvas für Foto-Capture */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Bild-Vorschau */}
              {image && !isCameraActive && (
                <div className="mb-3">
                  <img
                    src={image}
                    alt="Waagen-Display"
                    className="w-100 rounded"
                    style={{ maxHeight: '400px', objectFit: 'contain' }}
                  />
                </div>
              )}

              {/* Upload/Kamera-Buttons */}
              {!image && !isCameraActive && (
                <div className="d-grid gap-2 mb-3">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={startCamera}
                  >
                    📷 Kamera öffnen
                  </button>
                  <button
                    className="btn btn-outline-primary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📁 Bild hochladen
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              )}

              {/* Loading */}
              {isProcessing && (
                <div className="text-center my-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Verarbeite Bild...</span>
                  </div>
                  <p className="mt-2">OCR läuft...</p>
                </div>
              )}

              {/* Ergebnis */}
              {!isProcessing && recognizedWeight && (
                <div className="mt-3">
                  <div className="alert alert-info">
                    <h5>Erkanntes Gewicht:</h5>
                    <div className="display-4 text-center my-3">
                      {recognizedWeight} kg
                    </div>
                    <small className="text-muted">
                      Konfidenz: {Math.round(confidence)}%
                    </small>
                  </div>

                  {/* Warnung bei niedriger Konfidenz */}
                  {confidence < 70 && (
                    <div className="alert alert-warning">
                      ⚠️ Niedrige Erkennungsgenauigkeit - bitte überprüfen!
                    </div>
                  )}

                  {/* Gewicht bearbeiten */}
                  {!showManualInput ? (
                    <div className="mb-3">
                      <label className="form-label">Gewicht bestätigen oder korrigieren:</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control form-control-lg text-center"
                        value={manualWeight}
                        onChange={(e) => setManualWeight(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="mb-3">
                      <label className="form-label">Gewicht manuell eingeben:</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control form-control-lg text-center"
                        value={manualWeight}
                        onChange={(e) => setManualWeight(e.target.value)}
                        placeholder="z.B. 12.45"
                      />
                    </div>
                  )}

                  {/* Aktions-Buttons */}
                  <div className="d-grid gap-2">
                    <button
                      className="btn btn-success btn-lg"
                      onClick={confirmWeight}
                      disabled={!manualWeight}
                    >
                      ✓ Bestätigen
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => setShowManualInput(!showManualInput)}
                    >
                      ✏️ {showManualInput ? 'OCR-Wert nutzen' : 'Manuell eingeben'}
                    </button>
                    <button
                      className="btn btn-outline-danger"
                      onClick={resetForm}
                    >
                      🔄 Neues Foto
                    </button>
                  </div>

                  {/* Debug-Info (ausklappbar) */}
                  <details className="mt-3">
                    <summary className="text-muted" style={{ cursor: 'pointer' }}>
                      Debug-Informationen anzeigen
                    </summary>
                    <div className="mt-2 p-2 bg-light rounded">
                      <small>
                        <strong>Vollständiger OCR-Text:</strong>
                        <pre className="mt-1 mb-0">{extractedText}</pre>
                      </small>
                    </div>
                  </details>
                </div>
              )}

              {/* Hilfe-Text */}
              {!image && !isCameraActive && (
                <div className="alert alert-secondary mt-3">
                  <strong>Tipps für beste Ergebnisse:</strong>
                  <ul className="mb-0 mt-2">
                    <li>Gute Beleuchtung verwenden</li>
                    <li>Display frontal fotografieren</li>
                    <li>Nahe genug herangehen (Display füllt Bild)</li>
                    <li>Reflexionen vermeiden</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OCRTest;
