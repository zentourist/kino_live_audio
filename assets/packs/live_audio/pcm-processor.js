// PCM Processor AudioWorklet for Kino Live Audio
// Buffers audio samples and sends them in chunks

class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleBuffer = [];
    this.chunkSize = options.processorOptions?.chunkSize || 16000;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    // Only process if we have input data
    if (input && input.length > 0 && input[0]) {
      const inputData = input[0]; // First channel

      // Add samples to buffer
      for (let i = 0; i < inputData.length; i++) {
        this.sampleBuffer.push(inputData[i]);
      }

      // Send complete chunks
      while (this.sampleBuffer.length >= this.chunkSize) {
        const chunk = this.sampleBuffer.slice(0, this.chunkSize);
        this.port.postMessage(chunk);
        this.sampleBuffer = this.sampleBuffer.slice(this.chunkSize);
      }
    }

    // Keep processor alive
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
