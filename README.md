# KinoLiveAudio

[![KinoLiveAudio version](https://img.shields.io/hexpm/v/kino_live_audio.svg)](https://hex.pm/packages/kino_live_audio)
[![Hex Docs](https://img.shields.io/badge/hex-docs-lightgreen.svg)](https://hexdocs.pm/kino_live_audio/)
[![Hex Downloads](https://img.shields.io/hexpm/dt/kino_live_audio)](https://hex.pm/packages/kino_live_audio)
[![Twitter Follow](https://img.shields.io/twitter/follow/ac_alejos?style=social)](https://twitter.com/ac_alejos)

A Kino widget for recording raw audio streams from the browser microphone in Livebook. This library provides real-time access to microphone audio data that can be processed with Elixir/Nx, perfect for voice activity detection, speech recognition, and other audio processing tasks.

## Installation

The package can be installed by adding `kino_live_audio` to your list of dependencies in `mix.exs`:

```elixir
def deps do
  [
    {:kino_live_audio, "~> 0.2.0"}
  ]
end
```

## Quick Start

```elixir
# Create audio widget
audio = KinoLiveAudio.new(sample_rate: 16_000, chunk_size: 512, unit: :samples)

# Listen to audio events
audio
|> Kino.Control.stream()
|> Kino.listen(fn %{event: :audio_chunk, chunk: data} ->
  IO.puts("Received #{length(data)} audio samples")
end)
```

## Livebook Examples

- 📝 [Example Notebook](notebooks/vad.livemd) - Voice activity detection demo

## Development

To work on this library and rebuild the JavaScript assets:

1. Install Node.js dependencies:
   ```bash
   cd assets
   npm install
   ```

2. Build the assets:
   ```bash
   npm run build
   ```
   
   Or use the build script:
   ```bash
   mix build
   ```

3. For development with auto-rebuild:
   ```bash
   npm run dev
   ```

The built assets will be output to `lib/assets/live_audio/build/` and automatically included in the Kino widget.

## How It Works

KinoLiveAudio uses the Web Audio API's AudioWorklet to capture microphone audio directly in the browser. The audio is processed in real-time using a custom AudioWorkletProcessor that buffers samples and sends them in configurable chunks to the Livebook runtime.

The implementation:
1. Requests microphone access via `getUserMedia()`
2. Creates an AudioWorklet processor to buffer audio samples
3. Sends complete chunks to the Elixir backend via Kino events
4. Allows consumption via `Kino.Control.stream()` for processing in Elixir/Nx

## License

MIT
