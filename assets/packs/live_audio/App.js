import React, { useEffect, useState, useRef, useCallback } from "react";
import { RiMicLine, RiStopCircleLine } from "@remixicon/react";

export default function App({ ctx, payload }) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const sourceNodeRef = useRef(null);

  // Initialize AudioContext and AudioWorklet
  useEffect(() => {
    const initAudioContext = async () => {
      try {
        if (!window.AudioContext && !window.webkitAudioContext) {
          throw new Error("AudioContext is not supported in this browser");
        }

        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        const context = new AudioContextClass({
          sampleRate: payload.sampleRate,
        });

        // Create a blob URL for the processor to work with bundled code
        const processorCode = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleBuffer = [];
    this.chunkSize = options.processorOptions.chunkSize || 16000;
  }

  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const inputData = input[0];
      for (let i = 0; i < inputData.length; ++i) {
        this.sampleBuffer.push(inputData[i]);
        if (this.sampleBuffer.length >= this.chunkSize) {
          this.port.postMessage(this.sampleBuffer.slice(0, this.chunkSize));
          this.sampleBuffer = this.sampleBuffer.slice(this.chunkSize);
        }
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
        `;

        const blob = new Blob([processorCode], {
          type: "application/javascript",
        });
        const processorUrl = URL.createObjectURL(blob);

        await context.audioWorklet.addModule(processorUrl);
        URL.revokeObjectURL(processorUrl);

        const node = new AudioWorkletNode(context, "pcm-processor", {
          processorOptions: { chunkSize: payload.chunkSize },
        });

        node.port.onmessage = (event) => {
          ctx.pushEvent("audio_chunk", event.data);
        };

        audioContextRef.current = context;
        workletNodeRef.current = node;
        setIsInitializing(false);
      } catch (err) {
        console.error("Failed to initialize audio context:", err);
        setError(err.message);
        setIsInitializing(false);
      }
    };

    initAudioContext();

    // Cleanup on unmount
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch (e) {
          // Already disconnected
        }
      }
      if (workletNodeRef.current) {
        try {
          workletNodeRef.current.disconnect();
        } catch (e) {
          // Already disconnected
        }
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }
    };
  }, [payload.sampleRate, payload.chunkSize]);

  const startRecording = useCallback(async () => {
    if (!audioContextRef.current || isRecording || isInitializing) return;

    try {
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: payload.sampleRate,
        },
      });

      mediaStreamRef.current = stream;

      // Resume audio context if suspended
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      // Create and connect audio nodes
      const source = audioContextRef.current.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      source.connect(workletNodeRef.current);
      // Don't connect to destination to avoid feedback/echo

      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setError(err.message || "Failed to access microphone");

      // Cleanup on error
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    }
  }, [isRecording, isInitializing, payload.sampleRate]);

  const stopRecording = useCallback(() => {
    if (!audioContextRef.current || !isRecording) return;

    try {
      // Disconnect nodes
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }

      // Stop all media tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      setIsRecording(false);
    } catch (err) {
      console.error("Error stopping recording:", err);
      setError(err.message);
    }
  }, [isRecording]);

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="text-red-600 text-sm px-4 py-2 bg-red-50 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {isInitializing ? (
        <div className="button-base button-gray border-transparent py-2 px-4 inline-flex text-gray-500 opacity-50">
          <span>Initializing audio...</span>
        </div>
      ) : !isRecording ? (
        <RecordButton onClick={startRecording} disabled={!!error} />
      ) : (
        <StopButton onClick={stopRecording} />
      )}
    </div>
  );
}

function RecordButton({ onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="button-base button-gray border-transparent py-2 px-4 inline-flex text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RiMicLine className="text-lg leading-none mr-2" width="18" height="18" />
      <span>Record</span>
    </button>
  );
}

function StopButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="button-base button-red border-transparent py-2 px-4 inline-flex text-red-600 items-center"
    >
      <span className="mr-2 flex h-3 w-3 relative">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
      </span>
      <span>Stop recording</span>
    </button>
  );
}
