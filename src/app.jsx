import { h } from 'preact';
import { useState, useRef } from 'preact/hooks';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import logoImg from './assets/viverocosalinda.jpg';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId] = useState(uuidv4());
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedImageUrl, setCapturedImageUrl] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const inputFileRef = useRef(null);

  const additionalMessage =
    'Para más información, visita Vivero Cosa Linda en Merlo, Buenos Aires. Horarios: Lunes a Sábado de 8:00 a 17:00.';

  const sendMessage = async () => {
    if (input.trim() === '' || loading) return;

    setLoading(true);
    const newMessages = [...messages, { text: input, user: true }];
    setMessages(newMessages);
    setInput('');

    try {
      const response = await axios.post('http://localhost:5000/api/chat', {
        sessionId,
        message: input,
      });
      let aiMessage = response.data.message;
      aiMessage = `${aiMessage} ${additionalMessage}`;
      setMessages([...newMessages, { text: aiMessage, user: false }]);
    } catch (error) {
      console.error(
        'Error al enviar el mensaje:',
        error.response ? error.response.data : error.message
      );
      setMessages([
        ...newMessages,
        { text: 'Error al enviar el mensaje.', user: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file) => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('sessionId', sessionId);

    try {
      const response = await axios.post(
        'http://localhost:5000/api/upload-image',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      let aiMessage = response.data.message;
      const isPlantImage = aiMessage.includes('planta');
      if (isPlantImage) {
        aiMessage = `${aiMessage} ${additionalMessage}`;
      } else {
        aiMessage =
          'No puedo responder sobre esta imagen, ya que no es una planta.';
      }
      setMessages([
        ...messages,
        { text: 'Imagen subida', user: true },
        { text: aiMessage, user: false, viveroImage: isPlantImage },
      ]);
    } catch (error) {
      console.error('Error al subir la imagen:', error);
      setMessages([
        ...messages,
        { text: 'Error al subir la imagen.', user: false },
      ]);
    } finally {
      setLoading(false);
      setCameraOpen(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (error) {
      console.error('Error al iniciar la cámara:', error);
    }
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      const file = new File([blob], 'captured.jpg', { type: 'image/jpeg' });

      const url = URL.createObjectURL(blob);
      setCapturedImageUrl(url);

      setTimeout(() => {
        setCapturedImageUrl(null);
        video.pause();
        video.srcObject.getTracks().forEach((track) => track.stop());
        setCameraOpen(false);
        uploadImage(file);
        URL.revokeObjectURL(url);
      }, 2000);
    }, 'image/jpeg');
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      setCameraOpen(false);
    }
  };

  const closeImage = () => {
    setCapturedImageUrl(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-cover bg-center"
      style={{
        backgroundImage:
          'url("https://cdn.pixabay.com/photo/2017/04/08/09/31/flowers-2211849_1280.jpg")',
      }}
    >
      <header className="flex items-center p-4 bg-white bg-opacity-90 shadow-md">
        <div className="flex items-center">
          <img
            src={logoImg}
            alt="Vivero Cosa Linda"
            className="h-12 w-12 mr-4 rounded-full"
          />
          <div>
            <h1 className="text-2xl font-bold text-green-700">
              Vivero Cosa Linda
            </h1>
            <p className="text-sm text-green-500">Tu experto en plantas</p>
          </div>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto p-4 bg-white bg-opacity-90 rounded-lg shadow-md mx-4 mt-4 mb-5">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${
              msg.user ? 'justify-end' : 'justify-start'
            } mb-3`}
          >
            <div
              className={`p-2 rounded-lg max-w-xs ${
                msg.user ? 'bg-green-300' : 'bg-green-200'
              }`}
            >
              {msg.text}
              {msg.viveroImage && (
                <img
                  src={logoImg}
                  alt="Vivero Cosa Linda"
                  className="h-12 w-12 mr-4 rounded-full"
                />
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start mb-2">
            <div className="p-2 rounded-lg bg-green-200 animate-pulse flex">
              <div className="h-2.5 w-2.5 bg-green-600 rounded-full mr-1 animate-bounce"></div>
              <div className="h-2.5 w-2.5 bg-green-600 rounded-full mr-1 animate-bounce"></div>
              <div className="h-2.5 w-2.5 bg-green-600 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}
      </main>

      <footer className="flex items-center flex-wrap justify-center gap-2 mx-4 mb-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-grow p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Escribe tu pregunta sobre plantas..."
        />

        <input
          type="file"
          onChange={(e) => uploadImage(e.target.files[0])}
          className="hidden"
          ref={inputFileRef}
        />
        <button
          onClick={() => inputFileRef.current.click()}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          disabled={loading}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"
            />
          </svg>
        </button>
        <button
          onClick={sendMessage}
          className="bg-green-700 hover:bg-green-900 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          disabled={loading}
        >
          Enviar Mensaje
        </button>
        <button
          onClick={cameraOpen ? captureImage : startCamera}
          className={`${
            cameraOpen
              ? 'bg-blue-500 hover:bg-blue-700'
              : 'bg-green-500 hover:bg-green-700'
          } text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline`}
          disabled={loading}
        >
          {loading
            ? 'Enviando imagen...'
            : cameraOpen
            ? 'Sacar Foto'
            : 'Abrir Cámara'}
        </button>
        {cameraOpen && (
          <button
            onClick={closeCamera}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Cerrar Cámara
          </button>
        )}
      </footer>

      {cameraOpen && (
        <video
          ref={videoRef}
          className="mt-4 w-full max-w-md mx-auto rounded-lg border-2 border-green-300"
        ></video>
      )}
      {capturedImageUrl && (
        <div className="relative mt-4 w-full max-w-md mx-auto rounded-lg border-2 border-green-300">
          <img src={capturedImageUrl} alt="Captured" className="rounded-lg" />
          <button
            onClick={closeImage}
            className="absolute top-0 right-0 mt-2 mr-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline"
          >
            X
          </button>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
}

export default App;
