import "./main.css";

export function init(ctx, config) {
  ctx.root.innerHTML = `
    <div class="font-sans p-5 bg-gray-100 rounded-lg shadow-sm max-w-lg">
      <div class="flex gap-2.5 mb-4 flex-wrap">
        <button class="toggle-btn flex items-center gap-1.5 px-4 py-2.5 border-0 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 text-white flex-1 min-w-[140px] justify-center bg-red-600 hover:bg-red-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none" data-recording="false">
          <svg class="flex-shrink-0 record-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="8" r="6"/>
          </svg>
          <svg class="flex-shrink-0 stop-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
            <rect x="4" y="4" width="8" height="8"/>
          </svg>
          <span class="button-text">Start Recording</span>
        </button>
      </div>
      <div class="p-3 bg-white rounded-md text-center mb-3 border border-gray-200">
        <span class="timer-text text-2xl font-semibold text-gray-900 tabular-nums">00:00</span>
      </div>
      <div class="kino-live-audio-error mt-3 p-3 bg-yellow-50 border border-yellow-400 rounded-md text-yellow-800 text-sm" style="display: none;"></div>
    </div>
  `;

  ctx.importCSS("main.css");

  let audioContext = null;
  let workletNode = null;
  let stream = null;
  let startTime = null;
  let timerInterval = null;
  let isRecording = false;

  const toggleBtn = ctx.root.querySelector(".toggle-btn");
  const recordIcon = toggleBtn.querySelector(".record-icon");
  const stopIcon = toggleBtn.querySelector(".stop-icon");
  const buttonText = toggleBtn.querySelector(".button-text");
  const timerText = ctx.root.querySelector(".timer-text");
  const errorContainer = ctx.root.querySelector(".kino-live-audio-error");

  function updateButtonState(recording) {
    isRecording = recording;
    toggleBtn.setAttribute("data-recording", recording);

    if (recording) {
      // Show stop state
      recordIcon.style.display = "none";
      stopIcon.style.display = "block";
      buttonText.textContent = "Stop Recording";
      toggleBtn.classList.remove(
        "bg-red-600",
        "hover:bg-red-700",
        "hover:shadow-red-600/30",
      );
      toggleBtn.classList.add(
        "bg-gray-600",
        "hover:bg-gray-700",
        "hover:shadow-gray-600/30",
      );
    } else {
      // Show start state
      recordIcon.style.display = "block";
      stopIcon.style.display = "none";
      buttonText.textContent = "Start Recording";
      toggleBtn.classList.remove(
        "bg-gray-600",
        "hover:bg-gray-700",
        "hover:shadow-gray-600/30",
      );
      toggleBtn.classList.add(
        "bg-red-600",
        "hover:bg-red-700",
        "hover:shadow-red-600/30",
      );
    }
  }

  function updateTimer() {
    if (startTime) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60)
        .toString()
        .padStart(2, "0");
      const seconds = (elapsed % 60).toString().padStart(2, "0");
      timerText.textContent = `${minutes}:${seconds}`;
    }
  }

  function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resetTimer() {
    stopTimer();
    startTime = null;
    timerText.textContent = "00:00";
  }

  function showError(message) {
    errorContainer.textContent = message;
    errorContainer.style.display = "block";
  }

  function hideError() {
    errorContainer.style.display = "none";
  }

  async function startRecording() {
    try {
      hideError();

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: config.sample_rate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Get the actual sample rate from the stream
      // Firefox may not honor the requested sample rate
      const audioTrack = stream.getAudioTracks()[0];
      const streamSettings = audioTrack.getSettings();

      console.log(`[KinoLiveAudio] Stream settings:`, streamSettings);
      console.log(
        `[KinoLiveAudio] Requested sample rate: ${config.sample_rate} Hz`,
      );

      // Create AudioContext WITHOUT specifying sample rate
      // This ensures it matches the hardware/stream default rate
      // Firefox will then not complain about mismatched rates
      audioContext = new AudioContext();
      const streamSampleRate = audioContext.sampleRate;

      console.log(
        `[KinoLiveAudio] AudioContext created at hardware default: ${streamSampleRate} Hz`,
      );

      // Check if resampling is actually needed
      const needsResampling = streamSampleRate !== config.sample_rate;

      if (needsResampling) {
        console.log(
          `[KinoLiveAudio] Will resample from ${streamSampleRate} Hz to ${config.sample_rate} Hz in worklet`,
        );
      } else {
        console.log(
          `[KinoLiveAudio] Hardware rate matches target rate (${streamSampleRate} Hz) - no resampling needed! ✅`,
        );
      }

      // Load the AudioWorklet processor
      await audioContext.audioWorklet.addModule("./pcm-processor.js");

      // Create the AudioWorklet node
      workletNode = new AudioWorkletNode(audioContext, "pcm-processor", {
        processorOptions: {
          chunkSize: config.chunk_size,
          targetSampleRate: config.sample_rate,
          sourceSampleRate: streamSampleRate,
        },
      });

      // Handle PCM audio chunks from the worklet
      workletNode.port.onmessage = (event) => {
        const pcmData = new Float32Array(event.data);

        const info = {
          format: "pcm_f32le",
          sample_rate: config.sample_rate,
          channels: 1,
          samples: pcmData.length,
          size: event.data.byteLength,
          timestamp: Date.now(),
        };

        // Use event.data directly - it's already the transferred ArrayBuffer
        ctx.pushEvent("audio_chunk", [info, event.data]);
      };

      // Connect the audio graph
      console.log(`[KinoLiveAudio] Connecting audio graph...`);
      console.log(
        `[KinoLiveAudio] Stream tracks:`,
        stream.getAudioTracks().map((t) => ({
          id: t.id,
          label: t.label,
          settings: t.getSettings(),
        })),
      );

      const source = audioContext.createMediaStreamSource(stream);
      console.log(`[KinoLiveAudio] MediaStreamSource created successfully`);

      source.connect(workletNode);
      console.log(`[KinoLiveAudio] Source connected to worklet`);

      workletNode.connect(audioContext.destination);
      console.log(`[KinoLiveAudio] Worklet connected to destination`);

      startTimer();
      updateButtonState(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      showError(
        "Failed to access microphone. Please grant permission and try again.",
      );
      updateButtonState(false);
      resetTimer();
    }
  }

  function stopRecording() {
    if (workletNode) {
      stopTimer();

      // Disconnect and clean up audio nodes
      workletNode.disconnect();
      workletNode = null;

      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }

      updateButtonState(false);
    }
  }

  // Event listener for toggle button
  toggleBtn.addEventListener("click", () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // Handle events from Elixir
  ctx.handleEvent("start", () => {
    if (!isRecording) {
      startRecording();
    }
  });

  ctx.handleEvent("stop", () => {
    if (isRecording) {
      stopRecording();
    }
  });
}
