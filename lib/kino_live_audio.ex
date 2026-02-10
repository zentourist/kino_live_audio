defmodule KinoLiveAudio do
  @moduledoc """
  A Kino component for recording live audio from the browser in Livebook.

  This component allows you to capture raw PCM audio from the user's microphone
  and stream it as binary data for real-time processing. The audio is captured
  using the Web Audio API with AudioWorklet for low-latency access to raw samples.

  ## Examples

      # Create a simple audio recorder
      recorder = KinoLiveAudio.new()

      # Read the recorded audio data (raw PCM)
      audio_data = KinoLiveAudio.read(recorder)

      # Stream audio chunks as they're recorded
      recorder = KinoLiveAudio.new(chunk_size: 30, unit: :ms)

      Kino.listen(recorder, fn chunk ->
        # Process raw PCM audio chunk in real-time
        # Perfect for VAD, speech recognition, etc.
        IO.inspect(byte_size(chunk))
      end)

      # Start recording programmatically
      KinoLiveAudio.start_recording(recorder)

      # Stop recording programmatically
      KinoLiveAudio.stop_recording(recorder)

      # Clear the recorded audio
      KinoLiveAudio.clear(recorder)

  ## Options

  When creating a new recorder with `new/1`, you can pass the following options:

    * `:sample_rate` - the sample rate for recording. Common values are
      `8000`, `16000`, `44100`, `48000`. Defaults to `48000`.

    * `:chunk_size` - the size of audio chunks to stream. When set, audio
      chunks will be emitted as events that can be consumed with `Kino.listen/2`.
      Defaults to `nil` (no streaming).

    * `:unit` - the unit for `:chunk_size`. Either `:ms` (milliseconds) or
      `:samples`. Defaults to `:ms`.

  ## Audio Format

  The recorded audio is raw PCM (Pulse Code Modulation) data in 32-bit
  float little-endian format (`pcm_f32le`). Each sample is a Float32 value
  between -1.0 and 1.0, representing the audio waveform amplitude.

  This format is ideal for:
  - Voice Activity Detection (VAD)
  - Real-time speech recognition
  - Audio analysis and DSP
  - Custom audio processing pipelines

  To convert PCM to other formats, you can use FFmpeg or other audio tools.

  ## Streaming Audio

  When `:chunk_size` is specified, raw PCM chunks will be emitted as events
  during recording. This is perfect for real-time audio processing:

      recorder = KinoLiveAudio.new(chunk_size: 100, unit: :ms, sample_rate: 16000)

      Kino.listen(recorder, fn chunk ->
        # chunk is raw PCM data (Float32 samples)
        # Process chunk for VAD, transcription, etc.
        process_audio_chunk(chunk)
      end)

  """

  use Kino.JS, assets_path: "lib/assets/live_audio/build"
  use Kino.JS.Live

  @type t :: Kino.JS.Live.t()

  @doc """
  Creates a new live audio recorder.

  The recorder captures raw PCM audio data (32-bit float samples) from the
  browser's microphone using the Web Audio API.

  ## Options

    * `:sample_rate` - the sample rate in Hz. Defaults to `48000`.
      Common values: `8000`, `16000`, `44100`, `48000`

    * `:chunk_size` - size of streaming audio chunks. When set, chunks are
      emitted continuously during recording. Defaults to `nil` (no streaming)

    * `:unit` - unit for chunk_size (`:ms` or `:samples`). Defaults to `:ms`

  ## Examples

      # Basic recorder (no streaming, 48kHz)
      KinoLiveAudio.new()

      # Stream 30ms chunks at 16kHz (common for speech recognition)
      KinoLiveAudio.new(chunk_size: 30, unit: :ms, sample_rate: 16_000)

      # Stream 480 samples at a time (30ms at 16kHz)
      KinoLiveAudio.new(chunk_size: 480, unit: :samples, sample_rate: 16_000)

  """
  @spec new(keyword()) :: t()
  def new(opts \\ []) do
    sample_rate = Keyword.get(opts, :sample_rate, 48_000)
    chunk_size = Keyword.get(opts, :chunk_size)
    unit = Keyword.get(opts, :unit, :ms)

    unless is_integer(sample_rate) and sample_rate > 0 do
      raise ArgumentError,
            "expected :sample_rate to be a positive integer, got: #{inspect(sample_rate)}"
    end

    unless is_nil(chunk_size) or (is_integer(chunk_size) and chunk_size > 0) do
      raise ArgumentError,
            "expected :chunk_size to be a positive integer or nil, got: #{inspect(chunk_size)}"
    end

    unless unit in [:ms, :samples] do
      raise ArgumentError,
            "expected :unit to be :ms or :samples, got: #{inspect(unit)}"
    end

    Kino.JS.Live.new(__MODULE__, %{
      sample_rate: sample_rate,
      chunk_size: chunk_size,
      unit: unit,
      audio_data: nil
    })
  end

  @doc """
  Reads the recorded audio data.

  Returns the audio binary data or `nil` if no recording has been made.

  ## Examples

      recorder = KinoLiveAudio.new()
      # ... user records audio ...
      audio_data = KinoLiveAudio.read(recorder)

  """
  @spec read(t()) :: binary() | nil
  def read(kino) do
    Kino.JS.Live.call(kino, :read)
  end

  @doc """
  Starts recording audio.

  This allows programmatic control of recording.

  ## Examples

      recorder = KinoLiveAudio.new()
      KinoLiveAudio.start_recording(recorder)

  """
  @spec start_recording(t()) :: :ok
  def start_recording(kino) do
    Kino.JS.Live.cast(kino, :start_recording)
  end

  @doc """
  Stops recording audio.

  This allows programmatic control of recording.

  ## Examples

      recorder = KinoLiveAudio.new()
      KinoLiveAudio.stop_recording(recorder)

  """
  @spec stop_recording(t()) :: :ok
  def stop_recording(kino) do
    Kino.JS.Live.cast(kino, :stop_recording)
  end

  @doc """
  Clears the recorded audio data.

  ## Examples

      recorder = KinoLiveAudio.new()
      KinoLiveAudio.clear(recorder)

  """
  @spec clear(t()) :: :ok
  def clear(kino) do
    Kino.JS.Live.cast(kino, :clear)
  end

  @impl true
  def init(config, ctx) do
    {:ok, assign(ctx, config)}
  end

  @impl true
  def handle_connect(ctx) do
    payload = %{
      sample_rate: ctx.assigns.sample_rate,
      chunk_size: ctx.assigns.chunk_size,
      unit: ctx.assigns.unit
    }

    {:ok, payload, ctx}
  end

  @impl true
  def handle_event("audio_chunk", {:binary, _info, binary}, ctx) do
    # Emit the audio chunk as an event for Kino.listen
    emit_event(ctx, %{event: :audio_chunk, chunk: binary})
    {:noreply, ctx}
  end

  def handle_event("audio_data", {:binary, info, binary}, ctx) do
    ctx = assign(ctx, audio_data: binary)
    broadcast_event(ctx, "audio_saved", info)
    {:noreply, ctx}
  end

  @impl true
  def handle_call(:read, _from, ctx) do
    {:reply, ctx.assigns.audio_data, ctx}
  end

  @impl true
  def handle_cast(:start_recording, ctx) do
    broadcast_event(ctx, "start", %{})
    {:noreply, ctx}
  end

  def handle_cast(:stop_recording, ctx) do
    broadcast_event(ctx, "stop", %{})
    {:noreply, ctx}
  end

  def handle_cast(:clear, ctx) do
    ctx = assign(ctx, audio_data: nil)
    broadcast_event(ctx, "clear", %{})
    {:noreply, ctx}
  end
end
