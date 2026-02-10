/**
 * PCM Audio Processor for Web Audio API
 *
 * This AudioWorkletProcessor captures raw PCM audio data and sends it
 * in chunks to the main thread for processing. It supports resampling
 * to handle browser sample rate mismatches.
 *
 * Some browsers allow setting the sample rate directly on the AudioContext.
 * However, Firefox is one that does not and will raise an error when attempting
 * to set the sample rate. Right now, we are not attempting to set the sample
 * rate directly and will just rely on the resampling method.
 */

class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // Get parameters from options
    const opts = options.processorOptions || {};
    this.chunkSize = opts.chunkSize || 4800;
    this.targetSampleRate = opts.targetSampleRate || 48000;
    this.sourceSampleRate = opts.sourceSampleRate || 48000;

    this.buffer = [];
    this.needsResampling = this.sourceSampleRate !== this.targetSampleRate;

    // For resampling, we use linear interpolation
    this.resampleRatio = this.sourceSampleRate / this.targetSampleRate;
    this.resamplePosition = 0;

    // Performance tracking (only in debug builds)
    this.processCount = 0;
    this.resampleTimeTotal = 0;

    console.log(
      `PCMProcessor initialized:
       - Chunk size: ${this.chunkSize} samples (at ${this.targetSampleRate} Hz)
       - Source rate: ${this.sourceSampleRate} Hz
       - Target rate: ${this.targetSampleRate} Hz
       - Resampling: ${this.needsResampling ? "YES" : "NO"}
       ${this.needsResampling ? "- Method: Linear interpolation" : "- Fast path: Direct passthrough ⚡"}`,
    );
  }

  // Simple linear interpolation resampling
  resample(inputData) {
    if (!this.needsResampling) {
      return inputData;
    }

    const outputLength = Math.floor(inputData.length / this.resampleRatio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcPos = i * this.resampleRatio + this.resamplePosition;
      const srcIndex = Math.floor(srcPos);
      const frac = srcPos - srcIndex;

      if (srcIndex + 1 < inputData.length) {
        // Linear interpolation between two samples
        output[i] =
          inputData[srcIndex] * (1 - frac) + inputData[srcIndex + 1] * frac;
      } else if (srcIndex < inputData.length) {
        output[i] = inputData[srcIndex];
      }
    }

    // Update position for next chunk (keep fractional part for continuity)
    this.resamplePosition =
      (outputLength * this.resampleRatio + this.resamplePosition) % 1;

    return output;
  }

  process(inputs, outputs, parameters) {
    // Get the first input (microphone)
    const input = inputs[0];

    if (input.length > 0) {
      // Get data from the first channel (mono)
      const inputData = input[0];

      // Resample if needed
      const processedData = this.resample(inputData);

      // Accumulate samples to buffer
      for (let i = 0; i < processedData.length; i++) {
        this.buffer.push(processedData[i]);
      }

      // When buffer reaches chunk size, send it to main thread
      while (this.buffer.length >= this.chunkSize) {
        const chunk = this.buffer.splice(0, this.chunkSize);
        const float32Array = new Float32Array(chunk);
        // Transfer the buffer for efficiency instead of copying
        this.port.postMessage(float32Array.buffer, [float32Array.buffer]);
      }
    }

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
