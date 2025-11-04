/**
 * NOTE: This script requires face-api.js. Make sure to include it in your HTML:
 * <script src="https://cdn.jsdelivr.net/npm/face-api.js"></script>
 *
 * This script loads the required face-api.js models from a public CDN,
 * so you don't need to host the model files yourself.
 */

let trainedDescriptor = null;
let modelsLoaded = false;

async function initFaceApi() {
  if (modelsLoaded) return;
  try {
    // Models are loaded from a CDN instead of a local /models folder
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
    showToast("Loading face models...", "info");
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
    showToast("Face models loaded!", "success");
  } catch (error) {
    console.error("Error loading face-api models:", error);
    showToast("Could not load face models. See console.", "error");
  }
}

async function loadReferenceImage(file) {
  if (!modelsLoaded) await initFaceApi();
  if (!modelsLoaded) return;

  try {
    const img = await faceapi.bufferToImage(file);
    showToast("Analyzing reference image...", "info");
    const detections = await faceapi.detectSingleFace(img)
      .withFaceLandmarks().withFaceDescriptor();

    if (detections) {
      // **FIX:** Convert the Float32Array descriptor to a regular array before saving.
      // This ensures it can be correctly stored in JSON format in localStorage.
      const descriptorArray = Array.from(detections.descriptor);

      state.registeredFaces = [{
          name: state.userName,
          descriptor: descriptorArray // Save the plain array
      }];
      
      saveState(); // Persist the descriptor
      showToast("Reference face saved successfully!", "success");
    } else {
      showToast("No face detected in uploaded image.", "error");
    }
  } catch (error) {
    console.error("Error processing reference image:", error);
    showToast("Could not process the image.", "error");
  }
}

async function matchFromCamera(onMatch) {
  if (!modelsLoaded) await initFaceApi();
  if (!modelsLoaded) return;

  // **FIX:** Load the descriptor from the state and correctly convert it back to a Float32Array.
  let referenceDescriptor;
  if (state.registeredFaces && state.registeredFaces.length > 0 && state.registeredFaces[0].descriptor) {
      // The descriptor in the state is a plain array, so we reconstruct the Float32Array from it.
      referenceDescriptor = new Float32Array(state.registeredFaces[0].descriptor);
  }

  if (!referenceDescriptor) {
    showToast("Please upload a reference face image first.", "error");
    console.error("No valid face descriptor found in the application state.");
    return;
  }

  const overlay = document.getElementById('camera-overlay');
  const video = document.getElementById('face-video');
  overlay.classList.remove('hidden');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;

    const detectorOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 160 });

    const loop = async () => {
      // Add a check to stop the loop if the overlay is hidden by other means
      if (overlay.classList.contains('hidden')) {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
        }
        return;
      }

      const detections = await faceapi.detectSingleFace(video, detectorOpts)
        .withFaceLandmarks().withFaceDescriptor();

      if (detections) {
        // Compare the detected face with the saved descriptor.
        // The threshold (0.4) can be adjusted. Lower is stricter.
        const distance = faceapi.euclideanDistance(referenceDescriptor, detections.descriptor);
        if (distance < 0.4) {
          // --- MATCH FOUND ---
          video.srcObject.getTracks().forEach(t => t.stop()); // Stop the camera
          overlay.classList.add('hidden');
          showToast("Face matched! Personalizing layout...", "success");
          onMatch(); // Callback to apply the theme
          return; // Stop the loop
        }
      }
      requestAnimationFrame(loop); // Continue if no match
    };
    video.onplay = () => requestAnimationFrame(loop);

  } catch (err) {
    console.error("Camera access error:", err);
    showToast("Could not access camera. Please grant permission.", "error");
    overlay.classList.add('hidden');
  }
}

